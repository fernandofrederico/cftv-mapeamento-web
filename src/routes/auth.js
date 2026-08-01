const express = require('express');
const bcrypt = require('bcryptjs');

const {
  requireAuth,
  requireGuest,
} = require('../middlewares/auth');

const router = express.Router();

function obterHashAdministrador() {
  const hashBase64 = String(
    process.env.ADMIN_PASSWORD_HASH_B64 || ''
  ).trim();

  if (hashBase64) {
    const base64Valido =
      /^[A-Za-z0-9+/]+={0,2}$/.test(hashBase64) &&
      hashBase64.length % 4 === 0;

    if (!base64Valido) {
      return {
        hash: '',
        origem: 'base64-invalido',
      };
    }

    return {
      hash: Buffer.from(hashBase64, 'base64')
        .toString('utf8')
        .trim(),
      origem: 'base64',
    };
  }

  const hashDiretoOriginal = String(
    process.env.ADMIN_PASSWORD_HASH || ''
  ).trim();

  let hashDireto = hashDiretoOriginal;

  const possuiAspasDuplas =
    hashDireto.startsWith('"') &&
    hashDireto.endsWith('"');

  const possuiAspasSimples =
    hashDireto.startsWith("'") &&
    hashDireto.endsWith("'");

  if (possuiAspasDuplas || possuiAspasSimples) {
    hashDireto = hashDireto.slice(1, -1).trim();
  }

  const barrasAntesDoCifrao =
    (hashDireto.match(/\\\$/g) || []).length;

  hashDireto = hashDireto.replace(/\\\$/g, '$');

  return {
    hash: hashDireto,
    origem:
      hashDireto !== hashDiretoOriginal
        ? 'direto-normalizado'
        : 'direto',
    tamanhoOriginal: hashDiretoOriginal.length,
    barrasRemovidas: barrasAntesDoCifrao,
  };
}

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

    const resultadoHash = obterHashAdministrador();
    const senhaHash = resultadoHash.hash;

    const emailCorreto =
      Boolean(email) &&
      Boolean(emailAdministrador) &&
      email === emailAdministrador;

    const hashValido =
      /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(senhaHash);

    let senhaCorreta = false;

    if (senha && hashValido) {
      senhaCorreta = await bcrypt.compare(senha, senhaHash);
    }

    if (!emailCorreto || !senhaCorreta) {
      console.warn('[AUTH_DIAGNOSTICO]', {
        emailInformado: Boolean(email),
        emailConfigurado: Boolean(emailAdministrador),
        emailCorresponde: emailCorreto,
        origemHash: resultadoHash.origem,
        hashPresente: Boolean(senhaHash),
        hashValido,
        tamanhoHashOriginal:
          resultadoHash.tamanhoOriginal ?? senhaHash.length,
        tamanhoHash: senhaHash.length,
        barrasRemovidas:
          resultadoHash.barrasRemovidas ?? 0,
        senhaCorresponde: senhaCorreta,
      });

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
