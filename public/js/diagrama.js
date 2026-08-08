(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const dadosScript = document.getElementById('diagramaDadosIniciais');
  const svg = document.getElementById('diagramSvg');
  const SOMENTE_LEITURA = document.body.dataset.perfil !== 'administrador';

  if (!dadosScript || !svg) {
    return;
  }

  const dadosIniciais = JSON.parse(dadosScript.textContent || '{"nodes":[],"links":[]}');

  const estado = {
    nodes: dadosIniciais.nodes.map((n) => ({ ...n })),
    links: dadosIniciais.links.map((l) => ({ ...l })),
    selecionado: null,
    modoLigacao: false,
    primeiroNode: null,
    arraste: null,
    pan: null,
    zoom: 1,
    view: null,
    viewAjustada: null,
    dirty: new Set(),
    novosNaoSalvos: new Set(),
  };

  const infoTipo = {
    switch: ['Switch', '#2879a8'],
    box: ['Caixa técnica', '#576b7d'],
    rack: ['Rack/Data Center', '#303d49'],
    server: ['Servidor', '#4f6475'],
    router: ['Roteador', '#2c8a78'],
    cloud: ['Nuvem/Internet', '#6b7f91'],
    text: ['Texto', '#ffffff'],
  };

  function el(nome, attrs) {
    const elemento = document.createElementNS(SVG_NS, nome);
    Object.entries(attrs || {}).forEach(([chave, valor]) => {
      elemento.setAttribute(chave, String(valor));
    });
    return elemento;
  }

  function labelBox(n) {
    const fs = n.font_size || Math.max(9, Math.min(24, Math.round(n.size * 0.2)));
    return {
      w: Math.max(n.size + 16, (n.label || '').length * fs * 0.62 + Math.max(14, n.size * 0.22)),
      h: fs * 1.25 + Math.max(6, n.size * 0.1),
      fs,
    };
  }

  function bodyRect(n) {
    const s = +n.size;
    const h = s / 2;
    const t = n.node_type;

    if (t === 'switch') return { x: -h, y: -h * 0.55, w: s, h: s * 0.55 };
    if (t === 'rack') return { x: -h * 0.68, y: -h, w: s * 0.68, h: s };
    if (t === 'server') return { x: -h + 7, y: -h + 10, w: s - 14, h: s - 20 };
    if (t === 'box') return { x: -h + 4, y: -h + 4, w: s - 8, h: s - 8 };
    if (t === 'router') return { x: -h + 6, y: -h + 6, w: s - 12, h: s - 12 };
    if (t === 'cloud') return { x: -h * 0.72, y: -h * 0.55, w: s * 1.34, h: s * 0.85 };
    if (t === 'text') {
      const l = labelBox(n);
      return { x: -l.w / 2, y: -l.h / 2, w: l.w, h: l.h };
    }
    return { x: -h, y: -h, w: s, h: s };
  }

  function nodeBounds(n) {
    const b = bodyRect(n);
    const l = labelBox(n);
    const half = n.size / 2;
    return {
      x: n.pos_x + Math.min(b.x, -l.w / 2) - 8,
      y: n.pos_y + Math.min(b.y, -half) - 8,
      w: Math.max(b.x + b.w, l.w / 2) - Math.min(b.x, -l.w / 2) + 16,
      h: Math.max(b.y + b.h, half + 12 + l.h) - Math.min(b.y, -half) + 16,
    };
  }

  function allBounds() {
    if (!estado.nodes.length) {
      return { x: -500, y: -400, w: 1000, h: 800 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    estado.nodes.forEach((n) => {
      const b = nodeBounds(n);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    });

    const pad = 120;
    return {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(600, maxX - minX + pad * 2),
      h: Math.max(450, maxY - minY + pad * 2),
    };
  }

  function aplicarViewBox() {
    const base = estado.viewAjustada || allBounds();
    const z = estado.zoom;
    const cx = base.x + base.w / 2;
    const cy = base.y + base.h / 2;
    const w = base.w / z;
    const h = base.h / z;

    estado.view = { x: cx - w / 2, y: cy - h / 2, w, h };
    svg.setAttribute('viewBox', `${estado.view.x} ${estado.view.y} ${estado.view.w} ${estado.view.h}`);
  }

  function ajustarDiagrama(resetSlider) {
    const b = allBounds();
    const r = svg.getBoundingClientRect();
    const aspecto = Math.max(0.2, r.width / Math.max(1, r.height));

    let w = b.w;
    let h = b.h;

    if (w / h > aspecto) {
      h = w / aspecto;
    } else {
      w = h * aspecto;
    }

    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    estado.viewAjustada = { x: cx - w / 2, y: cy - h / 2, w, h };

    if (resetSlider) {
      estado.zoom = 1;
      document.getElementById('diagramZoom').value = 100;
      document.getElementById('diagramZoomLabel').textContent = '100%';
    }

    aplicarViewBox();
  }

  function pontoSvg(evento) {
    const ponto = svg.createSVGPoint();
    ponto.x = evento.clientX;
    ponto.y = evento.clientY;
    return ponto.matrixTransform(svg.getScreenCTM().inverse());
  }

  function connectionPoint(n, alvo) {
    const b = bodyRect(n);
    const dx = alvo.x - n.pos_x;
    const dy = alvo.y - n.pos_y;

    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
      return { x: n.pos_x, y: n.pos_y };
    }

    const candidatos = [];

    if (Math.abs(dx) > 1e-6) {
      [b.x, b.x + b.w].forEach((x) => {
        const t = x / dx;
        const y = dy * t;
        if (t > 0 && y >= b.y - 0.01 && y <= b.y + b.h + 0.01) {
          candidatos.push([t, { x: n.pos_x + x, y: n.pos_y + y }]);
        }
      });
    }

    if (Math.abs(dy) > 1e-6) {
      [b.y, b.y + b.h].forEach((y) => {
        const t = y / dy;
        const x = dx * t;
        if (t > 0 && x >= b.x - 0.01 && x <= b.x + b.w + 0.01) {
          candidatos.push([t, { x: n.pos_x + x, y: n.pos_y + y }]);
        }
      });
    }

    return candidatos.length
      ? candidatos.sort((a, b2) => a[0] - b2[0])[0][1]
      : { x: n.pos_x, y: n.pos_y };
  }

  function renderNodeShape(g, n) {
    const s = +n.size;
    const h = s / 2;
    const color = (infoTipo[n.node_type] || ['', '#456275'])[1];

    if (n.node_type === 'text') {
      return;
    }

    if (n.node_type === 'switch') {
      g.append(el('rect', { x: -h, y: -h * 0.55, width: s, height: s * 0.55, rx: s * 0.08, fill: color, stroke: 'white', 'stroke-width': Math.max(1.5, s * 0.025), class: 'node-shape' }));
      for (let i = 0; i < 8; i += 1) {
        const gap = s * 0.035;
        const pw = (s * 0.78 - gap * 7) / 8;
        const x = -s * 0.39 + i * (pw + gap);
        g.append(el('rect', { x, y: -s * 0.08, width: pw, height: pw * 0.72, fill: '#16222d', stroke: '#dceaf2', 'stroke-width': 1 }));
      }
      g.append(el('circle', { cx: s * 0.36, cy: -s * 0.2, r: s * 0.035, fill: '#76d275' }));
      return;
    }

    if (n.node_type === 'rack') {
      g.append(el('rect', { x: -h * 0.68, y: -h, width: s * 0.68, height: s, rx: s * 0.06, fill: color, stroke: 'white', 'stroke-width': Math.max(1.5, s * 0.025), class: 'node-shape' }));
      for (let i = 0; i < 5; i += 1) {
        g.append(el('rect', { x: -h * 0.52, y: -h * 0.72 + i * s * 0.17, width: s * 0.52, height: s * 0.1, rx: 2, fill: 'none', stroke: '#d7e2ea', 'stroke-width': Math.max(1, s * 0.018) }));
      }
      return;
    }

    if (n.node_type === 'server') {
      g.append(el('rect', { x: -h + 7, y: -h + 10, width: s - 14, height: s - 20, rx: s * 0.07, fill: color, stroke: 'white', 'stroke-width': Math.max(1.5, s * 0.025), class: 'node-shape' }));
      for (let i = 0; i < 3; i += 1) {
        const y = -h * 0.48 + i * s * 0.26;
        g.append(el('line', { x1: -h * 0.55, y1: y, x2: h * 0.35, y2: y, stroke: '#dce7ef', 'stroke-width': Math.max(1, s * 0.018) }));
        g.append(el('circle', { cx: h * 0.52, cy: y, r: s * 0.035, fill: '#76d275' }));
      }
      return;
    }

    if (n.node_type === 'router') {
      g.append(el('circle', { cx: 0, cy: 0, r: h - 6, fill: color, stroke: 'white', 'stroke-width': Math.max(1.5, s * 0.025), class: 'node-shape' }));
      g.append(el('path', { d: `M ${-s * 0.22} 0 H ${s * 0.22} M ${s * 0.1} ${-s * 0.1} L ${s * 0.22} 0 L ${s * 0.1} ${s * 0.1} M ${s * 0.22} ${-s * 0.22} V ${s * 0.22}`, fill: 'none', stroke: 'white', 'stroke-width': Math.max(2, s * 0.04) }));
      return;
    }

    if (n.node_type === 'cloud') {
      g.append(el('path', { d: `M ${-s * 0.36} ${s * 0.12} C ${-s * 0.47} ${-s * 0.02},${-s * 0.34} ${-s * 0.22},${-s * 0.18} ${-s * 0.18} C ${-s * 0.08} ${-s * 0.43},${s * 0.25} ${-s * 0.4},${s * 0.31} ${-s * 0.18} C ${s * 0.55} ${-s * 0.2},${s * 0.62} ${s * 0.1},${s * 0.44} ${s * 0.22} H ${-s * 0.24} C ${-s * 0.37} ${s * 0.22},${-s * 0.43} ${s * 0.17},${-s * 0.36} ${s * 0.12} Z`, fill: color, stroke: 'white', 'stroke-width': Math.max(1.5, s * 0.025), class: 'node-shape' }));
      return;
    }

    const b = bodyRect(n);
    g.append(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: s * 0.1, fill: color, stroke: 'white', 'stroke-width': Math.max(1.5, s * 0.025), class: 'node-shape' }));

    if (n.node_type === 'box') {
      [-0.25, 0.1, 0.45].forEach((v) => {
        g.append(el('line', { x1: -h * 0.68, y1: h * v, x2: h * 0.68, y2: h * v, stroke: '#dce7ef', 'stroke-width': Math.max(1, s * 0.025) }));
      });
    }
  }

  function podeEditar() {
    return true;
  }

  function selecionar(kind, id, rerender) {
    estado.selecionado = kind ? { kind, id } : null;
    if (rerender !== false) {
      renderizar();
    } else {
      atualizarInspetor();
    }
  }

  async function tratarCliqueLigacao(id) {
    if (!estado.primeiroNode) {
      estado.primeiroNode = id;
      document.getElementById('linkModeBtn').textContent = 'Selecione o 2º equipamento';
      return;
    }

    try {
      const resposta = await fetch('/diagrama/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_node_id: estado.primeiroNode,
          end_node_id: id,
          line_width: 3,
          line_color: '#2f86c1',
          line_style: 'solid',
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        throw new Error(dados.erro || 'Falha ao criar ligação.');
      }

      estado.links.push(dados.link);
    } catch (erro) {
      window.alert(erro.message || 'Não foi possível criar a ligação.');
    }

    estado.modoLigacao = false;
    estado.primeiroNode = null;
    document.getElementById('linkModeBtn').textContent = 'Criar ligação';
    renderizar();
  }

  function renderizar() {
    const gLinks = document.getElementById('diagramLinks');
    const gNodes = document.getElementById('diagramNodes');
    gLinks.innerHTML = '';
    gNodes.innerHTML = '';

    const porId = new Map(estado.nodes.map((n) => [n.id, n]));

    estado.links.forEach((l) => {
      const a = porId.get(l.start_node_id);
      const b = porId.get(l.end_node_id);
      if (!a || !b) return;

      const p1 = connectionPoint(a, { x: b.pos_x, y: b.pos_y });
      const p2 = connectionPoint(b, { x: a.pos_x, y: a.pos_y });

      const linha = el('line', {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: l.line_color, 'stroke-width': l.line_width,
        'vector-effect': 'non-scaling-stroke',
      });

      if (l.line_style === 'dash' || l.line_style === 'dashed') {
        linha.setAttribute('stroke-dasharray', '10 7');
      }
      if (l.line_style === 'dot') {
        linha.setAttribute('stroke-dasharray', '2 6');
      }

      linha.classList.add('diagram-link');
      if (estado.selecionado?.kind === 'link' && estado.selecionado.id === l.id) {
        linha.classList.add('selected');
      }

      linha.addEventListener('click', (evento) => {
        evento.stopPropagation();
        selecionar('link', l.id);
      });

      gLinks.append(linha);
    });

    estado.nodes.forEach((n) => {
      const g = el('g', { transform: `translate(${n.pos_x},${n.pos_y})` });
      g.classList.add('diagram-node');

      if (estado.selecionado?.kind === 'node' && estado.selecionado.id === n.id) {
        g.classList.add('selected');
      }

      renderNodeShape(g, n);

      const lb = labelBox(n);
      const texto = el('text', {
        'text-anchor': 'middle',
        y: n.node_type === 'text' ? lb.fs * 0.35 : n.size / 2 + 12 + lb.fs,
        fill: '#243447',
        'font-size': lb.fs,
        'font-weight': 700,
      });
      texto.textContent = n.label;
      g.append(texto);

      g.addEventListener('pointerdown', (evento) => {
        evento.stopPropagation();

        if (estado.modoLigacao) {
          tratarCliqueLigacao(n.id);
          return;
        }

        selecionar('node', n.id, false);

        if (SOMENTE_LEITURA) {
          return;
        }

        const p = pontoSvg(evento);
        estado.arraste = { id: evento.pointerId, node: n, dx: p.x - n.pos_x, dy: p.y - n.pos_y };
        g.classList.add('dragging');
        g.setPointerCapture(evento.pointerId);
      });

      g.addEventListener('pointermove', (evento) => {
        if (!estado.arraste || estado.arraste.id !== evento.pointerId) return;
        const p = pontoSvg(evento);
        n.pos_x = p.x - estado.arraste.dx;
        n.pos_y = p.y - estado.arraste.dy;
        estado.dirty.add(n.id);
        renderizar();
      });

      g.addEventListener('pointerup', (evento) => {
        if (estado.arraste?.id === evento.pointerId) {
          estado.arraste = null;
          g.classList.remove('dragging');
        }
      });

      g.addEventListener('dblclick', (evento) => {
        evento.stopPropagation();
        selecionar('node', n.id);
      });

      gNodes.append(g);
    });

    atualizarInspetor();
  }

  function atualizarInspetor() {
    const s = estado.selecionado;
    document.getElementById('inspectorEmpty').classList.toggle('hidden', Boolean(s));
    document.getElementById('nodeInspector').classList.add('hidden');
    document.getElementById('linkInspector').classList.add('hidden');

    if (!s) return;

    if (s.kind === 'node') {
      const n = estado.nodes.find((x) => x.id === s.id);
      if (!n) return;
      document.getElementById('nodeInspector').classList.remove('hidden');
      document.getElementById('nodeLabel').value = n.label;
      document.getElementById('nodeSize').value = n.size;
      document.getElementById('nodeFontSize').value = n.font_size;
    } else {
      const l = estado.links.find((x) => x.id === s.id);
      if (!l) return;
      document.getElementById('linkInspector').classList.remove('hidden');
      document.getElementById('linkWidth').value = l.line_width;
      document.getElementById('linkColor').value = l.line_color;
      document.getElementById('linkStyle').value = l.line_style;
    }
  }

  // --- Paleta: criar novo equipamento ---
  document.querySelectorAll('[data-node-type]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const tipo = botao.dataset.nodeType;
      const [nome] = infoTipo[tipo] || ['Equipamento'];
      const v = estado.view || allBounds();

      try {
        const resposta = await fetch('/diagrama/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            node_type: tipo,
            label: nome,
            pos_x: v.x + v.w / 2,
            pos_y: v.y + v.h / 2,
            size: 72,
            font_size: 0,
          }),
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
          throw new Error(dados.erro || 'Falha ao criar equipamento.');
        }

        estado.nodes.push(dados.node);
        selecionar('node', dados.node.id);
      } catch (erro) {
        window.alert(erro.message || 'Não foi possível criar o equipamento.');
      }
    });
  });

  // --- Aplicar edição do node selecionado (fica pendente até salvar) ---
  document.getElementById('applyNodeBtn')?.addEventListener('click', () => {
    const s = estado.selecionado;
    if (!s) return;
    const n = estado.nodes.find((x) => x.id === s.id);
    if (!n) return;

    n.label = document.getElementById('nodeLabel').value;
    n.size = Number(document.getElementById('nodeSize').value) || n.size;
    n.font_size = Number(document.getElementById('nodeFontSize').value) || 0;
    estado.dirty.add(n.id);
    renderizar();
  });

  // --- Aplicar edição da ligação selecionada (salva na hora) ---
  document.getElementById('applyLinkBtn')?.addEventListener('click', async () => {
    const s = estado.selecionado;
    if (!s) return;
    const l = estado.links.find((x) => x.id === s.id);
    if (!l) return;

    l.line_width = Number(document.getElementById('linkWidth').value) || 3;
    l.line_color = document.getElementById('linkColor').value;
    l.line_style = document.getElementById('linkStyle').value;

    try {
      await fetch(`/diagrama/links/${l.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_width: l.line_width,
          line_color: l.line_color,
          line_style: l.line_style,
        }),
      });
    } catch (erro) {
      window.alert('Não foi possível salvar a ligação.');
    }

    renderizar();
  });

  // --- Modo de criar ligação ---
  document.getElementById('linkModeBtn')?.addEventListener('click', () => {
    estado.modoLigacao = !estado.modoLigacao;
    estado.primeiroNode = null;
    document.getElementById('linkModeBtn').textContent = estado.modoLigacao
      ? 'Selecione o 1º equipamento'
      : 'Criar ligação';
  });

  // --- Excluir selecionado ---
  document.getElementById('deleteDiagramBtn')?.addEventListener('click', async () => {
    const s = estado.selecionado;
    if (!s) return;
    if (!window.confirm('Excluir o item selecionado?')) return;

    try {
      await fetch(`/diagrama/${s.kind === 'node' ? 'nodes' : 'links'}/${s.id}`, {
        method: 'DELETE',
      });

      if (s.kind === 'node') {
        estado.nodes = estado.nodes.filter((n) => n.id !== s.id);
        estado.links = estado.links.filter(
          (l) => l.start_node_id !== s.id && l.end_node_id !== s.id
        );
      } else {
        estado.links = estado.links.filter((l) => l.id !== s.id);
      }

      estado.selecionado = null;
      renderizar();
    } catch (erro) {
      window.alert('Não foi possível excluir.');
    }
  });

  // --- Salvar diagrama (envia as posições/edições pendentes) ---
  document.getElementById('saveDiagramBtn')?.addEventListener('click', async () => {
    const botao = document.getElementById('saveDiagramBtn');
    const textoOriginal = botao.textContent;
    botao.textContent = 'Salvando…';
    botao.disabled = true;

    try {
      for (const id of estado.dirty) {
        const n = estado.nodes.find((x) => x.id === id);
        if (!n) continue;

        await fetch(`/diagrama/nodes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: n.label,
            pos_x: n.pos_x,
            pos_y: n.pos_y,
            size: n.size,
            font_size: n.font_size,
          }),
        });
      }

      estado.dirty.clear();
      botao.textContent = 'Salvo!';
    } catch (erro) {
      botao.textContent = 'Erro ao salvar';
    } finally {
      setTimeout(() => {
        botao.textContent = textoOriginal;
        botao.disabled = false;
      }, 1200);
    }
  });

  // --- Zoom (centrado no cursor do mouse) ---
  function zoomEm(deltaZoom, clientX, clientY) {
    const novoZoom = Math.max(0.25, Math.min(3, estado.zoom + deltaZoom));

    if (novoZoom === estado.zoom || !estado.view) {
      return;
    }

    const base = estado.viewAjustada || allBounds();
    const viewAtual = estado.view;
    const rect = svg.getBoundingClientRect();

    const fracX = (clientX - rect.left) / rect.width;
    const fracY = (clientY - rect.top) / rect.height;

    const mundoX = viewAtual.x + fracX * viewAtual.w;
    const mundoY = viewAtual.y + fracY * viewAtual.h;

    const novaLargura = base.w / novoZoom;
    const novaAltura = base.h / novoZoom;

    estado.zoom = novoZoom;
    estado.view = {
      x: mundoX - fracX * novaLargura,
      y: mundoY - fracY * novaAltura,
      w: novaLargura,
      h: novaAltura,
    };

    svg.setAttribute('viewBox', `${estado.view.x} ${estado.view.y} ${estado.view.w} ${estado.view.h}`);
    document.getElementById('diagramZoom').value = Math.round(novoZoom * 100);
    document.getElementById('diagramZoomLabel').textContent = `${Math.round(novoZoom * 100)}%`;
  }

  function zoomNoCentro(deltaZoom) {
    const rect = svg.getBoundingClientRect();
    zoomEm(deltaZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function definirZoomAbsoluto(v) {
    zoomNoCentro(Math.max(0.25, Math.min(3, v)) - estado.zoom);
  }

  document.getElementById('diagramZoom').addEventListener('input', (evento) => {
    definirZoomAbsoluto(Number(evento.target.value) / 100);
  });
  document.getElementById('zoomInBtn').addEventListener('click', () => zoomNoCentro(0.15));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoomNoCentro(-0.15));
  document.getElementById('fitDiagramBtn').addEventListener('click', () => ajustarDiagrama(true));

  document.getElementById('diagramWork').addEventListener(
    'wheel',
    (evento) => {
      evento.preventDefault();
      const direcao = evento.deltaY < 0 ? 1 : -1;
      zoomEm(direcao * 0.12, evento.clientX, evento.clientY);
    },
    { passive: false }
  );

  // --- Pan (clicar no fundo do SVG e arrastar) ---
  svg.addEventListener('pointerdown', (evento) => {
    if (evento.target !== svg) return;
    selecionar(null, null, false);
    const p = pontoSvg(evento);
    estado.pan = { id: evento.pointerId, p, view: { ...estado.view } };
    svg.setPointerCapture(evento.pointerId);
    document.getElementById('diagramWork').classList.add('panning');
  });

  svg.addEventListener('pointermove', (evento) => {
    const p = estado.pan;
    if (!p || p.id !== evento.pointerId) return;
    const q = pontoSvg(evento);
    estado.view = { ...p.view, x: p.view.x - (q.x - p.p.x), y: p.view.y - (q.y - p.p.y) };
    svg.setAttribute('viewBox', `${estado.view.x} ${estado.view.y} ${estado.view.w} ${estado.view.h}`);
  });

  svg.addEventListener('pointerup', () => {
    estado.pan = null;
    document.getElementById('diagramWork').classList.remove('panning');
  });

  // --- Inicialização ---
  ajustarDiagrama(true);
  renderizar();
})();
