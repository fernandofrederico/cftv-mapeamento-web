const express = require('express');
const bcrypt = require('bcryptjs');

const {
  requireAuth,
  requireGuest,
} = require('../middlewares/auth');

const {
  getRuntimeConfig,
} = require('../config/runtime-config');

const { getDatabasePool } = require('../config/database');

const router = express.Router();

router.get('/login', requireGuest, (req, res) => {
  res.render('login', {
    titulo: 'Entrar',
    erro: null,
  });
});

router.post('/login', requireGuest, async (req, res, next) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();

    const senha = String(req.body.senha || '');

    const emailAdministrador = String(
      process.env.ADMIN_EMAIL || ''
    )
      .trim()
      .toLowerCase();

    const runtimeConfig = getRuntimeConfig();
    const senhaHash = runtimeConfig.adminPasswordHash;

    const emailCorreto =
      Boolean(email) &&
      Boolean(emailAdministrador) &&
      email === emailAdministrador;

    const hashValido =
      /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(senhaHash);

    let senhaCorreta = false;

    if (senha && emailCorreto && hashValido) {
      senhaCorreta = await bcrypt.compare(senha, senhaHash);
    }

    if (emailCorreto && senhaCorreta) {
      return autenticarSessao(req, res, next, {
        id: 1,
        nome: 'Administrador',
        email: emailAdministrador,
        perfil: 'administrador',
      });
    }

    // Não é o admin de ambiente — tenta na tabela de usuários.
    if (email && senha) {
      const pool = getDatabasePool();

      const [linhas] = await pool.query(
        `SELECT id, nome, email, senha_hash, perfil
         FROM usuarios
         WHERE email = ? AND ativo = 1`,
        [email]
      );

      const usuario = linhas[0];

      if (usuario) {
        const senhaValida = await bcrypt.compare(
          senha,
          usuario.senha_hash
        );

        if (senhaValida) {
          return autenticarSessao(req, res, next, {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil,
          });
        }
      }
    }

    return res.status(401).render('login', {
      titulo: 'Entrar',
      erro: 'E-mail ou senha inválidos.',
    });
  } catch (erro) {
    return next(erro);
  }
});

function autenticarSessao(req, res, next, dadosUsuario) {
  req.session.regenerate((erro) => {
    if (erro) {
      return next(erro);
    }

    req.session.usuario = dadosUsuario;

    return req.session.save((erroSalvar) => {
      if (erroSalvar) {
        return next(erroSalvar);
      }

      return res.redirect('/dashboard');
    });
  });
}

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
