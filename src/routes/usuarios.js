const express = require('express');
const bcrypt = require('bcryptjs');

const { requireAdmin } = require('../middlewares/auth');
const { getDatabasePool } = require('../config/database');

const router = express.Router();

router.get('/usuarios', requireAdmin, async (req, res, next) => {
  try {
    const pool = getDatabasePool();

    const [usuarios] = await pool.query(`
      SELECT id, nome, email, perfil, ativo, criado_em
      FROM usuarios
      ORDER BY nome
    `);

    return res.render('usuarios', {
      titulo: 'Usuários',
      usuario: req.session.usuario,
      usuarios,
      erro: null,
    });
  } catch (erro) {
    return next(erro);
  }
});

router.post('/usuarios', requireAdmin, async (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    const senha = String(req.body.senha || '');
    const perfil = req.body.perfil === 'administrador'
      ? 'administrador'
      : 'usuario';

    const pool = getDatabasePool();

    if (!nome || !email || senha.length < 6) {
      const [usuarios] = await pool.query(`
        SELECT id, nome, email, perfil, ativo, criado_em
        FROM usuarios
        ORDER BY nome
      `);

      return res.status(400).render('usuarios', {
        titulo: 'Usuários',
        usuario: req.session.usuario,
        usuarios,
        erro: 'Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.',
      });
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil)
       VALUES (?, ?, ?, ?)`,
      [nome, email, senhaHash, perfil]
    );

    return res.redirect('/usuarios');
  } catch (erro) {
    if (erro && erro.code === 'ER_DUP_ENTRY') {
      const pool = getDatabasePool();
      const [usuarios] = await pool.query(`
        SELECT id, nome, email, perfil, ativo, criado_em
        FROM usuarios
        ORDER BY nome
      `);

      return res.status(400).render('usuarios', {
        titulo: 'Usuários',
        usuario: req.session.usuario,
        usuarios,
        erro: 'Já existe um usuário com esse e-mail.',
      });
    }

    return next(erro);
  }
});

router.post(
  '/usuarios/:id/perfil',
  requireAdmin,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const perfil = req.body.perfil === 'administrador'
        ? 'administrador'
        : 'usuario';

      if (!Number.isInteger(id)) {
        return res.redirect('/usuarios');
      }

      const pool = getDatabasePool();
      await pool.query(
        'UPDATE usuarios SET perfil = ? WHERE id = ?',
        [perfil, id]
      );

      return res.redirect('/usuarios');
    } catch (erro) {
      return next(erro);
    }
  }
);

router.post(
  '/usuarios/:id/ativo',
  requireAdmin,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const ativo = req.body.ativo === '1' ? 1 : 0;

      if (!Number.isInteger(id)) {
        return res.redirect('/usuarios');
      }

      const pool = getDatabasePool();
      await pool.query(
        'UPDATE usuarios SET ativo = ? WHERE id = ?',
        [ativo, id]
      );

      return res.redirect('/usuarios');
    } catch (erro) {
      return next(erro);
    }
  }
);

router.post(
  '/usuarios/:id/excluir',
  requireAdmin,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.redirect('/usuarios');
      }

      const pool = getDatabasePool();
      await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);

      return res.redirect('/usuarios');
    } catch (erro) {
      return next(erro);
    }
  }
);

module.exports = router;
