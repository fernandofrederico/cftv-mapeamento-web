const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const express = require('express');
const multer = require('multer');

const { requireAuth } = require('../middlewares/auth');
const { getDatabasePool } = require('../config/database');

const router = express.Router();

const PASTA_UPLOADS = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'uploads',
  'mapa'
);

fs.mkdirSync(PASTA_UPLOADS, { recursive: true });

const EXTENSOES_PERMITIDAS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PASTA_UPLOADS);
  },
  filename: (req, file, cb) => {
    const extensao = path
      .extname(file.originalname)
      .toLowerCase();

    const nomeUnico = `${Date.now()}-${crypto
      .randomBytes(6)
      .toString('hex')}${extensao}`;

    cb(null, nomeUnico);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extensao = path
      .extname(file.originalname)
      .toLowerCase();

    if (!EXTENSOES_PERMITIDAS.has(extensao)) {
      return cb(new Error('Formato de imagem não suportado.'));
    }

    return cb(null, true);
  },
});

async function buscarConfiguracaoMapa(pool) {
  const [linhas] = await pool.query(
    'SELECT imagem_path FROM mapa_config WHERE id = 1'
  );

  return linhas[0] || { imagem_path: '' };
}

router.get('/mapa', requireAuth, async (req, res, next) => {
  try {
    const pool = getDatabasePool();

    const [caixasBrutas] = await pool.query(`
      SELECT
        caixa.id,
        caixa.codigo,
        caixa.descricao,
        caixa.localizacao,
        caixa.pos_x,
        caixa.pos_y,
        caixa.switch_nome,
        caixa.switch_ip,
        caixa.switch_portas,
        caixa.foto_painel,
        caixa.foto_switch,
        (
          SELECT COUNT(*)
          FROM cameras AS camera
          WHERE camera.caixa_id = caixa.id
        ) AS total_cameras
      FROM caixas AS caixa
      ORDER BY caixa.codigo
    `);

    const caixas = caixasBrutas.map((caixa) => ({
      ...caixa,
      total_cameras: Number(caixa.total_cameras),
    }));

    const configuracao = await buscarConfiguracaoMapa(pool);

    return res.render('mapa', {
      titulo: 'Mapa de CFTV',
      usuario: req.session.usuario,
      caixas,
      imagemMapa: configuracao.imagem_path || null,
      erroUpload: null,
    });
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
      const caminhoPublico = `/uploads/mapa/${req.file.filename}`;

      const configuracaoAnterior = await buscarConfiguracaoMapa(pool);

      await pool.query(
        `INSERT INTO mapa_config (id, imagem_path, atualizado_em)
         VALUES (1, ?, NOW())
         ON DUPLICATE KEY UPDATE
           imagem_path = VALUES(imagem_path),
           atualizado_em = VALUES(atualizado_em)`,
        [caminhoPublico]
      );

      if (
        configuracaoAnterior.imagem_path &&
        configuracaoAnterior.imagem_path.startsWith('/uploads/mapa/')
      ) {
        const arquivoAntigo = path.join(
          PASTA_UPLOADS,
          path.basename(configuracaoAnterior.imagem_path)
        );

        fs.unlink(arquivoAntigo, () => {});
      }

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

module.exports = router;
