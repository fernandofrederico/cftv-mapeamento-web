const express = require('express');
const multer = require('multer');

const { requireAuth, requireAdmin } = require('../middlewares/auth');
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

const TIPOS_FOTO = new Set(['painel', 'switch']);

router.get('/caixas', requireAuth, async (req, res, next) => {
  try {
    const pool = getDatabasePool();

    const [caixas] = await pool.query(`
      SELECT
        caixa.id,
        caixa.codigo,
        caixa.descricao,
        caixa.localizacao,
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

    return res.render('caixas', {
      titulo: 'Caixas e switches',
      usuario: req.session.usuario,
      caixas: caixas.map((caixa) => ({
        ...caixa,
        total_cameras: Number(caixa.total_cameras),
      })),
    });
  } catch (erro) {
    return next(erro);
  }
});

router.get(
  '/caixas/:id/foto/:tipo',
  requireAuth,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const tipo = req.params.tipo;

      if (!Number.isInteger(id) || !TIPOS_FOTO.has(tipo)) {
        return res.status(400).send('Requisição inválida.');
      }

      const pool = getDatabasePool();
      const colunaDados = `foto_${tipo}_dados`;
      const colunaMime = `foto_${tipo}_mime`;

      const [linhas] = await pool.query(
        `SELECT ${colunaDados} AS dados, ${colunaMime} AS mime
         FROM caixas
         WHERE id = ?`,
        [id]
      );

      const registro = linhas[0];

      if (!registro || !registro.dados) {
        return res.status(404).send('Nenhuma foto cadastrada.');
      }

      res.set('Content-Type', registro.mime || 'image/jpeg');
      res.set('Cache-Control', 'private, max-age=60');
      return res.send(registro.dados);
    } catch (erro) {
      return next(erro);
    }
  }
);

router.post(
  '/caixas/:id/foto/:tipo',
  requireAdmin,
  (req, res, next) => {
    upload.single('foto')(req, res, (erroUpload) => {
      if (erroUpload) {
        return res.status(400).json({ ok: false, erro: erroUpload.message });
      }

      return next();
    });
  },
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const tipo = req.params.tipo;

      if (!Number.isInteger(id) || !TIPOS_FOTO.has(tipo)) {
        return res.status(400).json({ ok: false, erro: 'Requisição inválida.' });
      }

      if (!req.file) {
        return res.status(400).json({ ok: false, erro: 'Nenhum arquivo enviado.' });
      }

      const pool = getDatabasePool();
      const colunaDados = `foto_${tipo}_dados`;
      const colunaMime = `foto_${tipo}_mime`;

      const [resultado] = await pool.query(
        `UPDATE caixas
         SET ${colunaDados} = ?, ${colunaMime} = ?
         WHERE id = ?`,
        [req.file.buffer, req.file.mimetype, id]
      );

      if (resultado.affectedRows === 0) {
        return res.status(404).json({ ok: false, erro: 'Caixa não encontrada.' });
      }

      return res.json({
        ok: true,
        url: `/caixas/${id}/foto/${tipo}?v=${Date.now()}`,
      });
    } catch (erro) {
      return next(erro);
    }
  }
);

module.exports = router;
