const express = require('express');

const { requireAuth } = require('../middlewares/auth');
const { getDatabasePool } = require('../config/database');

const router = express.Router();

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const pool = getDatabasePool();

    const [linhas] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM caixas) AS caixas,
        (SELECT COUNT(*) FROM cameras) AS cameras,
        (SELECT COUNT(*) FROM diagram_nodes) AS elementosDiagrama
    `);

    const contagens = linhas[0];

    return res.render('dashboard', {
      titulo: 'Dashboard',
      usuario: req.session.usuario,
      indicadores: {
        caixas: Number(contagens.caixas),
        cameras: Number(contagens.cameras),
        elementosDiagrama: Number(contagens.elementosDiagrama),
        documentos: 0,
      },
    });
  } catch (erro) {
    return next(erro);
  }
});

module.exports = router;
