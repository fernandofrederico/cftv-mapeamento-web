const express = require('express');
const bcrypt = require('bcryptjs');

const {
  requireAuth,
  requireGuest,
} = require('../middlewares/auth');

const router = express.Router();

router.get('/login', requireGuest, (req, res) => {
  res.render('login', {
    titulo: 'Entrar',
    erro: null,
  });
});

router.post('/login', requireGuest, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');

    const emailAdministrador = String(
      process.env.ADMIN_EMAIL || ''
    ).trim().toLowerCase();

    const senhaHash = process.env.ADMIN_PASSWORD_HASH || '';

    if (!email || !senha || !emailAdministrador || !senhaHash) {
      return res.status(401).render('login', {
        titulo: 'Entrar',
        erro: 'E-mail ou senha inválidos.',
      });
    }

    const emailCorreto = email === emailAdministrador;
    const senhaCorreta = await bcrypt.compare(senha, senhaHash);

    if (!emailCorreto || !senhaCorreta) {
      return res.status(401).render('login', {
        titulo: 'Entrar',
        erro: 'E-mail ou senha inválidos.',
      });
    }

    req.session.regenerate((erro) => {
      if (erro) {
        return next(erro);
      }

      req.session.usuario = {
        id: 1,
        nome: 'Administrador',
        email: emailAdministrador,
        perfil: 'administrador',
      };

      return req.session.save((erroSalvar) => {
        if (erroSalvar) {
          return next(erroSalvar);
        }

        return res.redirect('/dashboard');
      });
    });
  } catch (erro) {
    return next(erro);
  }
});

router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((erro) => {
    if (erro) {
      return next(erro);
    }

    res.clearCookie('cftv.sid');
    return res.redirect('/login');
  });
});

module.exports = router;
