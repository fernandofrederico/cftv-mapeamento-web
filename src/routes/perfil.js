const express = require('express');
const bcrypt = require('bcryptjs');

const { requireAuth } = require('../middlewares/auth');
const { getDatabasePool } = require('../config/database');

const router = express.Router();

router.get('/minha-conta', requireAuth, (req, res) => {
  res.render('minha-conta', {
    titulo: 'Minha conta',
    usuario: req.session.usuario,
    erro: null,
    sucesso: null,
  });
});

router.post('/minha-conta', requireAuth, async (req, res, next) => {
  const usuarioSessao = req.session.usuario;

  if (usuarioSessao.origemAmbiente) {
    return res.status(400).render('minha-conta', {
      titulo: 'Minha conta',
      usuario: usuarioSessao,
      erro:
        'Esta conta é definida por configuração do servidor e não pode ser editada por aqui.',
      sucesso: null,
    });
  }

  try {
    const nome = String(req.body.nome || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const senhaNova = String(req.body.senha_nova || '');
    const senhaAtual = String(req.body.senha_atual || '');

    if (!nome || !email) {
      return res.status(400).render('minha-conta', {
        titulo: 'Minha conta',
        usuario: usuarioSessao,
        erro: 'Preencha nome e e-mail.',
        sucesso: null,
      });
    }

    const pool = getDatabasePool();

    const [linhasAtual] = await pool.query(
      'SELECT senha_hash FROM usuarios WHERE id = ?',
      [usuarioSessao.id]
    );

    const contaAtual = linhasAtual[0];

    if (!contaAtual) {
      return res.status(404).render('minha-conta', {
        titulo: 'Minha conta',
        usuario: usuarioSessao,
        erro: 'Conta não encontrada.',
        sucesso: null,
      });
    }

    // Qualquer alteração exige confirmar a senha atual.
    if (!senhaAtual) {
      return res.status(400).render('minha-conta', {
        titulo: 'Minha conta',
        usuario: usuarioSessao,
        erro: 'Informe sua senha atual para confirmar as alterações.',
        sucesso: null,
      });
    }

    const senhaAtualValida = await bcrypt.compare(
      senhaAtual,
      contaAtual.senha_hash
    );

    if (!senhaAtualValida) {
      return res.status(400).render('minha-conta', {
        titulo: 'Minha conta',
        usuario: usuarioSessao,
        erro: 'Senha atual incorreta.',
        sucesso: null,
      });
    }

    if (senhaNova && senhaNova.length < 6) {
      return res.status(400).render('minha-conta', {
        titulo: 'Minha conta',
        usuario: usuarioSessao,
        erro: 'A nova senha precisa ter pelo menos 6 caracteres.',
        sucesso: null,
      });
    }

    if (senhaNova) {
      const novoHash = await bcrypt.hash(senhaNova, 12);
      await pool.query(
        'UPDATE usuarios SET nome = ?, email = ?, senha_hash = ? WHERE id = ?',
        [nome, email, novoHash, usuarioSessao.id]
      );
    } else {
      await pool.query(
        'UPDATE usuarios SET nome = ?, email = ? WHERE id = ?',
        [nome, email, usuarioSessao.id]
      );
    }

    req.session.usuario.nome = nome;
    req.session.usuario.email = email;

    return req.session.save((erroSalvar) => {
      if (erroSalvar) {
        return next(erroSalvar);
      }

      return res.render('minha-conta', {
        titulo: 'Minha conta',
        usuario: req.session.usuario,
        erro: null,
        sucesso: 'Dados atualizados com sucesso.',
      });
    });
  } catch (erro) {
    if (erro && erro.code === 'ER_DUP_ENTRY') {
      return res.status(400).render('minha-conta', {
        titulo: 'Minha conta',
        usuario: usuarioSessao,
        erro: 'Já existe outra conta com esse e-mail.',
        sucesso: null,
      });
    }

    return next(erro);
  }
});

module.exports = router;
