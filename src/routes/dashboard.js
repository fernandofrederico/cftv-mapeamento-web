const express = require('express');

const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', {
    titulo: 'Dashboard',
    usuario: req.session.usuario,
    indicadores: {
      caixas: 15,
      cameras: 96,
      elementosDiagrama: 46,
      documentos: 0,
    },
  });
});

module.exports = router;
