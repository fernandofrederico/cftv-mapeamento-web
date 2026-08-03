const express = require('express');

const { requireAuth } = require('../middlewares/auth');
const { getDatabasePool } = require('../config/database');

const router = express.Router();

router.get('/diagrama', requireAuth, async (req, res, next) => {
  try {
    const pool = getDatabasePool();

    const [nodes] = await pool.query(`
      SELECT id, node_type, label, pos_x, pos_y, size, font_size
      FROM diagram_nodes
      ORDER BY id
    `);

    const [links] = await pool.query(`
      SELECT id, start_node_id, end_node_id, line_width, line_color, line_style
      FROM diagram_links
      ORDER BY id
    `);

    return res.render('diagrama', {
      titulo: 'Diagrama de rede',
      usuario: req.session.usuario,
      nodesIniciais: nodes,
      linksIniciais: links,
    });
  } catch (erro) {
    return next(erro);
  }
});

router.post('/diagrama/nodes', requireAuth, async (req, res, next) => {
  try {
    const nodeType = String(req.body.node_type || '').trim();
    const label = String(req.body.label || '').trim();
    const posX = Number(req.body.pos_x) || 0;
    const posY = Number(req.body.pos_y) || 0;
    const size = Number(req.body.size) || 72;
    const fontSize = Number(req.body.font_size) || 0;

    if (!nodeType) {
      return res.status(400).json({ ok: false, erro: 'Tipo de equipamento inválido.' });
    }

    const pool = getDatabasePool();

    const [resultado] = await pool.query(
      `INSERT INTO diagram_nodes (node_type, label, pos_x, pos_y, size, font_size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nodeType, label, posX, posY, size, fontSize]
    );

    return res.json({
      ok: true,
      node: {
        id: resultado.insertId,
        node_type: nodeType,
        label,
        pos_x: posX,
        pos_y: posY,
        size,
        font_size: fontSize,
      },
    });
  } catch (erro) {
    return next(erro);
  }
});

router.put('/diagrama/nodes/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, erro: 'ID inválido.' });
    }

    const label = String(req.body.label || '').trim();
    const posX = Number(req.body.pos_x) || 0;
    const posY = Number(req.body.pos_y) || 0;
    const size = Number(req.body.size) || 72;
    const fontSize = Number(req.body.font_size) || 0;

    const pool = getDatabasePool();

    await pool.query(
      `UPDATE diagram_nodes
       SET label = ?, pos_x = ?, pos_y = ?, size = ?, font_size = ?
       WHERE id = ?`,
      [label, posX, posY, size, fontSize, id]
    );

    return res.json({ ok: true });
  } catch (erro) {
    return next(erro);
  }
});

router.delete('/diagrama/nodes/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, erro: 'ID inválido.' });
    }

    const pool = getDatabasePool();
    await pool.query('DELETE FROM diagram_nodes WHERE id = ?', [id]);

    return res.json({ ok: true });
  } catch (erro) {
    return next(erro);
  }
});

router.post('/diagrama/links', requireAuth, async (req, res, next) => {
  try {
    const startNodeId = Number(req.body.start_node_id);
    const endNodeId = Number(req.body.end_node_id);
    const lineWidth = Number(req.body.line_width) || 3;
    const lineColor = String(req.body.line_color || '#2f86c1');
    const lineStyle = String(req.body.line_style || 'solid');

    if (!Number.isInteger(startNodeId) || !Number.isInteger(endNodeId)) {
      return res.status(400).json({ ok: false, erro: 'Equipamentos inválidos.' });
    }

    if (startNodeId === endNodeId) {
      return res.status(400).json({
        ok: false,
        erro: 'Escolha dois equipamentos diferentes para ligar.',
      });
    }

    const pool = getDatabasePool();

    const [resultado] = await pool.query(
      `INSERT INTO diagram_links
         (start_node_id, end_node_id, line_width, line_color, line_style)
       VALUES (?, ?, ?, ?, ?)`,
      [startNodeId, endNodeId, lineWidth, lineColor, lineStyle]
    );

    return res.json({
      ok: true,
      link: {
        id: resultado.insertId,
        start_node_id: startNodeId,
        end_node_id: endNodeId,
        line_width: lineWidth,
        line_color: lineColor,
        line_style: lineStyle,
      },
    });
  } catch (erro) {
    return next(erro);
  }
});

router.put('/diagrama/links/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, erro: 'ID inválido.' });
    }

    const lineWidth = Number(req.body.line_width) || 3;
    const lineColor = String(req.body.line_color || '#2f86c1');
    const lineStyle = String(req.body.line_style || 'solid');

    const pool = getDatabasePool();

    await pool.query(
      `UPDATE diagram_links
       SET line_width = ?, line_color = ?, line_style = ?
       WHERE id = ?`,
      [lineWidth, lineColor, lineStyle, id]
    );

    return res.json({ ok: true });
  } catch (erro) {
    return next(erro);
  }
});

router.delete('/diagrama/links/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, erro: 'ID inválido.' });
    }

    const pool = getDatabasePool();
    await pool.query('DELETE FROM diagram_links WHERE id = ?', [id]);

    return res.json({ ok: true });
  } catch (erro) {
    return next(erro);
  }
});

module.exports = router;
