const express = require('express');
const multer = require('multer');

const { requireAuth } = require('../middlewares/auth');
const { getDatabasePool } = require('../config/database');

const router = express.Router();

const MIMES_PERMITIDOS = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!MIMES_PERMITIDOS.has(file.mimetype)) {
      return cb(new Error('Formato de imagem não suportado.'));
    }

    return cb(null, true);
  },
});

async function buscarConfiguracaoMapa(pool) {
  const [linhas] = await pool.query(
    `SELECT
       (imagem_dados IS NOT NULL) AS tem_imagem,
       atualizado_em
     FROM mapa_config
     WHERE id = 1`
  );

  return linhas[0] || { tem_imagem: 0, atualizado_em: null };
}

router.get('/mapa', requireAuth, async (req, res, next) => {
  try {
    const pool = getDatabasePool();

    const [caixas] = await pool.query(`
      SELECT id, codigo, pos_x, pos_y
      FROM caixas
      ORDER BY codigo
    `);

    const configuracao = await buscarConfiguracaoMapa(pool);

    const versaoImagem = configuracao.atualizado_em
      ? new Date(configuracao.atualizado_em).getTime()
      : 0;

    return res.render('mapa', {
      titulo: 'Mapa de CFTV',
      usuario: req.session.usuario,
      caixas,
      imagemMapa: configuracao.tem_imagem
        ? `/mapa/imagem-atual?v=${versaoImagem}`
        : null,
      erroUpload: null,
    });
  } catch (erro) {
    return next(erro);
  }
});

router.get('/mapa/imagem-atual', requireAuth, async (req, res, next) => {
  try {
    const pool = getDatabasePool();

    const [linhas] = await pool.query(
      'SELECT imagem_dados, imagem_mime FROM mapa_config WHERE id = 1'
    );

    const registro = linhas[0];

    if (!registro || !registro.imagem_dados) {
      return res.status(404).send('Nenhuma imagem cadastrada.');
    }

    res.set('Content-Type', registro.imagem_mime || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(registro.imagem_dados);
  } catch (erro) {
    return next(erro);
  }
});

router.post(
  '/mapa/imagem',
  requireAuth,
  (req, res, next) => {
    upload.single('mapa')(req, res, (erroUpload) => {
      if (erroUpload) {
        return res.status(400).render('mapa', {
          titulo: 'Mapa de CFTV',
          usuario: req.session.usuario,
          caixas: [],
          imagemMapa: null,
          erroUpload: erroUpload.message,
        });
      }

      return next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.redirect('/mapa');
      }

      const pool = getDatabasePool();

      await pool.query(
        `INSERT INTO mapa_config (id, imagem_dados, imagem_mime, atualizado_em)
         VALUES (1, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           imagem_dados = VALUES(imagem_dados),
           imagem_mime = VALUES(imagem_mime),
           atualizado_em = VALUES(atualizado_em)`,
        [req.file.buffer, req.file.mimetype]
      );

      return res.redirect('/mapa');
    } catch (erro) {
      return next(erro);
    }
  }
);

router.post(
  '/mapa/caixas/:id/posicao',
  requireAuth,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const posX = Number(req.body.pos_x);
      const posY = Number(req.body.pos_y);

      if (
        !Number.isInteger(id) ||
        !Number.isFinite(posX) ||
        !Number.isFinite(posY)
      ) {
        return res.status(400).json({
          ok: false,
          erro: 'Dados de posição inválidos.',
        });
      }

      const pool = getDatabasePool();

      const [resultado] = await pool.query(
        'UPDATE caixas SET pos_x = ?, pos_y = ? WHERE id = ?',
        [posX, posY, id]
      );

      if (resultado.affectedRows === 0) {
        return res.status(404).json({
          ok: false,
          erro: 'Caixa não encontrada.',
        });
      }

      return res.json({ ok: true });
    } catch (erro) {
      return next(erro);
    }
  }
);

router.get(
  '/mapa/caixas/:id/detalhes',
  requireAuth,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({ ok: false, erro: 'ID inválido.' });
      }

      const pool = getDatabasePool();

      const [caixas] = await pool.query(
        `SELECT id, codigo, descricao, localizacao,
                switch_nome, switch_ip, switch_portas,
                foto_painel, foto_switch
         FROM caixas
         WHERE id = ?`,
        [id]
      );

      const caixa = caixas[0];

      if (!caixa) {
        return res.status(404).json({ ok: false, erro: 'Caixa não encontrada.' });
      }

      const [cameras] = await pool.query(
        `SELECT porta, numero, nome, ip, localizacao, observacoes
         FROM cameras
         WHERE caixa_id = ?
         ORDER BY porta`,
        [id]
      );

      const caminhoWebValido = (caminho) =>
        Boolean(caminho) &&
        (caminho.startsWith('/') || caminho.startsWith('http'));

      return res.json({
        ok: true,
        caixa: {
          id: caixa.id,
          codigo: caixa.codigo,
          descricao: caixa.descricao,
          localizacao: caixa.localizacao,
          switch_nome: caixa.switch_nome,
          switch_ip: caixa.switch_ip,
          switch_portas: caixa.switch_portas,
          foto_painel_url: caminhoWebValido(caixa.foto_painel)
            ? caixa.foto_painel
            : null,
          foto_switch_url: caminhoWebValido(caixa.foto_switch)
            ? caixa.foto_switch
            : null,
        },
        cameras,
      });
    } catch (erro) {
      return next(erro);
    }
  }
);

module.exports = router;
