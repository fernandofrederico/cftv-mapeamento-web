const express = require('express');

const { requireAuth } = require('../middlewares/auth');
const { getDatabasePool } = require('../config/database');

const router = express.Router();

const CAMPOS_LISTA = `
  camera.id, camera.caixa_id, camera.porta, camera.numero, camera.nome,
  camera.ip, camera.localizacao, camera.observacoes,
  camera.criado_por_nome, camera.criado_em,
  camera.atualizado_por_nome, camera.atualizado_em,
  caixa.codigo AS caixa_codigo
`;

async function buscarCaixasParaSelect(pool) {
  const [caixas] = await pool.query(
    'SELECT id, codigo FROM caixas ORDER BY codigo'
  );
  return caixas;
}

async function buscarCameras(pool) {
  const [cameras] = await pool.query(`
    SELECT ${CAMPOS_LISTA}
    FROM cameras AS camera
    INNER JOIN caixas AS caixa ON caixa.id = camera.caixa_id
    ORDER BY caixa.codigo, camera.porta
  `);
  return cameras;
}

router.get('/cameras', requireAuth, async (req, res, next) => {
  try {
    const pool = getDatabasePool();
    const cameras = await buscarCameras(pool);
    const caixas = await buscarCaixasParaSelect(pool);

    return res.render('cameras', {
      titulo: 'Câmeras',
      usuario: req.session.usuario,
      cameras,
      caixas,
      erro: null,
    });
  } catch (erro) {
    return next(erro);
  }
});

router.post('/cameras', requireAuth, async (req, res, next) => {
  try {
    const caixaId = Number(req.body.caixa_id);
    const porta = Number(req.body.porta);
    const numero = String(req.body.numero || '').trim();
    const nome = String(req.body.nome || '').trim();
    const ip = String(req.body.ip || '').trim();
    const localizacao = String(req.body.localizacao || '').trim();
    const observacoes = String(req.body.observacoes || '').trim();

    const pool = getDatabasePool();
    const ator = req.session.usuario;

    if (!Number.isInteger(caixaId) || !Number.isInteger(porta) || porta < 1) {
      const cameras = await buscarCameras(pool);
      const caixas = await buscarCaixasParaSelect(pool);

      return res.status(400).render('cameras', {
        titulo: 'Câmeras',
        usuario: ator,
        cameras,
        caixas,
        erro: 'Escolha a caixa e informe uma porta válida.',
      });
    }

    await pool.query(
      `INSERT INTO cameras
         (caixa_id, porta, numero, nome, ip, localizacao, observacoes,
          criado_por_nome, criado_por_email, criado_em,
          atualizado_por_nome, atualizado_por_email, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW())`,
      [
        caixaId, porta, numero, nome, ip, localizacao, observacoes,
        ator.nome, ator.email,
        ator.nome, ator.email,
      ]
    );

    return res.redirect('/cameras');
  } catch (erro) {
    if (erro && erro.code === 'ER_DUP_ENTRY') {
      const pool = getDatabasePool();
      const cameras = await buscarCameras(pool);
      const caixas = await buscarCaixasParaSelect(pool);

      return res.status(400).render('cameras', {
        titulo: 'Câmeras',
        usuario: req.session.usuario,
        cameras,
        caixas,
        erro: 'Essa porta já está ocupada por outra câmera nessa caixa.',
      });
    }

    return next(erro);
  }
});

router.get('/cameras/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, erro: 'ID inválido.' });
    }

    const pool = getDatabasePool();
    const [linhas] = await pool.query(
      `SELECT id, caixa_id, porta, numero, nome, ip, localizacao, observacoes,
              criado_por_nome, criado_por_email, criado_em,
              atualizado_por_nome, atualizado_por_email, atualizado_em
       FROM cameras
       WHERE id = ?`,
      [id]
    );

    const camera = linhas[0];

    if (!camera) {
      return res.status(404).json({ ok: false, erro: 'Câmera não encontrada.' });
    }

    return res.json({ ok: true, camera });
  } catch (erro) {
    return next(erro);
  }
});

router.put('/cameras/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, erro: 'ID inválido.' });
    }

    const caixaId = Number(req.body.caixa_id);
    const porta = Number(req.body.porta);
    const numero = String(req.body.numero || '').trim();
    const nome = String(req.body.nome || '').trim();
    const ip = String(req.body.ip || '').trim();
    const localizacao = String(req.body.localizacao || '').trim();
    const observacoes = String(req.body.observacoes || '').trim();

    if (!Number.isInteger(caixaId) || !Number.isInteger(porta) || porta < 1) {
      return res.status(400).json({ ok: false, erro: 'Escolha a caixa e uma porta válida.' });
    }

    const pool = getDatabasePool();
    const ator = req.session.usuario;

    await pool.query(
      `UPDATE cameras
       SET caixa_id = ?, porta = ?, numero = ?, nome = ?, ip = ?, localizacao = ?, observacoes = ?,
           atualizado_por_nome = ?, atualizado_por_email = ?, atualizado_em = NOW()
       WHERE id = ?`,
      [
        caixaId, porta, numero, nome, ip, localizacao, observacoes,
        ator.nome, ator.email,
        id,
      ]
    );

    return res.json({ ok: true });
  } catch (erro) {
    if (erro && erro.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        ok: false,
        erro: 'Essa porta já está ocupada por outra câmera nessa caixa.',
      });
    }

    return next(erro);
  }
});

router.post('/cameras/:id/excluir', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.redirect('/cameras');
    }

    const pool = getDatabasePool();
    await pool.query('DELETE FROM cameras WHERE id = ?', [id]);

    return res.redirect('/cameras');
  } catch (erro) {
    return next(erro);
  }
});

module.exports = router;
