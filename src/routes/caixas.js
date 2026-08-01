const express = require('express');

const { requireAuth } = require('../middlewares/auth');
const { getDatabasePool } = require('../config/database');

const router = express.Router();

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

module.exports = router;
