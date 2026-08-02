(function () {
  const markersLayer = document.getElementById('markersLayer');
  const modalBackdrop = document.getElementById('caixaModalBackdrop');

  const LIMITE_CLIQUE_PX = 6;

  let marcadorAtivo = null;
  let offsetX = 0;
  let offsetY = 0;
  let posicaoSalva = { x: 0, y: 0 };
  let inicioX = 0;
  let inicioY = 0;
  let houveArraste = false;
  let camerasDaCaixaAtual = [];

  function limitesDoPalco() {
    const palco = document.getElementById('mapStage');
    return palco.getBoundingClientRect();
  }

  function textoOu(valor, fallback) {
    const texto = String(valor || '').trim();
    return texto || fallback;
  }

  function montarPreviewFoto(elemento, url, textoAlternativo) {
    elemento.innerHTML = '';

    if (!url) {
      elemento.textContent =
        'Sem foto disponível (arquivo do sistema antigo, fora do site)';
      return;
    }

    const img = document.createElement('img');
    img.src = url;
    img.alt = textoAlternativo;
    elemento.appendChild(img);
  }

  function esconderDetalheCamera() {
    const painel = document.getElementById('caixaModalCameraDetalhe');
    if (painel) {
      painel.classList.add('hidden');
    }
  }

  function mostrarDetalheCamera(camera, porta) {
    const painel = document.getElementById('caixaModalCameraDetalhe');
    document.getElementById('cameraDetalheTitulo').textContent =
      `Porta ${String(porta).padStart(2, '0')}`;
    document.getElementById('cameraDetalheNumero').textContent =
      textoOu(camera.numero, '—');
    document.getElementById('cameraDetalheNome').textContent =
      textoOu(camera.nome, '—');
    document.getElementById('cameraDetalheIp').textContent =
      textoOu(camera.ip, '—');
    document.getElementById('cameraDetalheLocalizacao').textContent =
      textoOu(camera.localizacao, '—');
    document.getElementById('cameraDetalheObservacoes').textContent =
      textoOu(camera.observacoes, '—');
    painel.classList.remove('hidden');
  }

  function montarGridDePortas(totalPortas, cameras) {
    const grid = document.getElementById('caixaModalPortasGrid');
    grid.innerHTML = '';

    const cameraPorPorta = new Map(
      cameras.map((camera) => [camera.porta, camera])
    );

    for (let porta = 1; porta <= totalPortas; porta += 1) {
      const camera = cameraPorPorta.get(porta);
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = `port-btn ${camera ? 'used' : 'free'}`;
      botao.innerHTML = `${String(porta).padStart(2, '0')}<br>${
        camera ? textoOu(camera.numero || camera.nome, 'Câmera') : 'Livre'
      }`;

      if (camera) {
        botao.addEventListener('click', () => {
          mostrarDetalheCamera(camera, porta);
        });
      }

      grid.appendChild(botao);
    }
  }

  function ativarAba(nomeAba) {
    document.querySelectorAll('.tab').forEach((botao) => {
      botao.classList.toggle('active', botao.dataset.tab === nomeAba);
    });

    document.querySelectorAll('.tab-panel').forEach((painel) => {
      painel.classList.toggle('active', painel.id === `tab-${nomeAba}`);
    });
  }

  async function abrirModal(marcador) {
    if (!modalBackdrop) {
      return;
    }

    const id = marcador.dataset.id;
    const codigo = marcador.dataset.codigo || 'Caixa';

    document.getElementById('caixaModalTitulo').textContent = codigo;
    ativarAba('geral');
    esconderDetalheCamera();
    modalBackdrop.classList.remove('hidden');

    document.getElementById('caixaModalDescricao').textContent = 'Carregando…';
    document.getElementById('caixaModalLocalizacao').textContent = '';
    document.getElementById('caixaModalSwitch').textContent = '';
    document.getElementById('caixaModalIp').textContent = '';
    document.getElementById('caixaModalPortasGrid').innerHTML = '';

    try {
      const resposta = await fetch(`/mapa/caixas/${id}/detalhes`);

      if (!resposta.ok) {
        throw new Error('Falha ao carregar detalhes.');
      }

      const dados = await resposta.json();
      const caixa = dados.caixa;
      camerasDaCaixaAtual = dados.cameras || [];

      document.getElementById('caixaModalDescricao').textContent =
        textoOu(caixa.descricao, 'Caixa técnica');
      document.getElementById('caixaModalLocalizacao').textContent =
        textoOu(caixa.localizacao, 'Não informada');
      document.getElementById('caixaModalSwitch').textContent =
        textoOu(caixa.switch_nome, 'Não informado');
      document.getElementById('caixaModalIp').textContent =
        textoOu(caixa.switch_ip, 'Não informado');

      montarPreviewFoto(
        document.getElementById('caixaModalFotoPainel'),
        caixa.foto_painel_url,
        'Foto do painel'
      );
      montarPreviewFoto(
        document.getElementById('caixaModalFotoSwitch'),
        caixa.foto_switch_url,
        'Foto do switch'
      );

      montarGridDePortas(caixa.switch_portas, camerasDaCaixaAtual);
    } catch (erro) {
      document.getElementById('caixaModalDescricao').textContent =
        'Não foi possível carregar os detalhes desta caixa.';
    }
  }

  function fecharModal() {
    if (modalBackdrop) {
      modalBackdrop.classList.add('hidden');
    }
  }

  function iniciarArraste(evento) {
    const marcador = evento.target.closest('.marker');

    if (!marcador) {
      return;
    }

    marcadorAtivo = marcador;
    houveArraste = false;
    inicioX = evento.clientX;
    inicioY = evento.clientY;

    marcadorAtivo.setPointerCapture(evento.pointerId);

    const retanguloPalco = limitesDoPalco();
    const x = evento.clientX - retanguloPalco.left;
    const y = evento.clientY - retanguloPalco.top;

    offsetX = x - parseFloat(marcadorAtivo.style.left || '0');
    offsetY = y - parseFloat(marcadorAtivo.style.top || '0');

    posicaoSalva = {
      x: parseFloat(marcadorAtivo.style.left || '0'),
      y: parseFloat(marcadorAtivo.style.top || '0'),
    };
  }

  function moverArraste(evento) {
    if (!marcadorAtivo) {
      return;
    }

    const deslocamento = Math.hypot(
      evento.clientX - inicioX,
      evento.clientY - inicioY
    );

    if (deslocamento > LIMITE_CLIQUE_PX) {
      houveArraste = true;
      marcadorAtivo.classList.add('dragging');
    }

    if (!houveArraste) {
      return;
    }

    const retanguloPalco = limitesDoPalco();
    const x = evento.clientX - retanguloPalco.left;
    const y = evento.clientY - retanguloPalco.top;

    const novoX = Math.max(0, x - offsetX);
    const novoY = Math.max(0, y - offsetY);

    marcadorAtivo.style.left = `${novoX}px`;
    marcadorAtivo.style.top = `${novoY}px`;

    posicaoSalva = { x: novoX, y: novoY };
  }

  async function salvarPosicao(id, posicao) {
    try {
      const resposta = await fetch(`/mapa/caixas/${id}/posicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pos_x: posicao.x,
          pos_y: posicao.y,
        }),
      });

      if (!resposta.ok) {
        throw new Error('Falha ao salvar posição.');
      }
    } catch (erro) {
      return false;
    }

    return true;
  }

  async function finalizarArraste() {
    if (!marcadorAtivo) {
      return;
    }

    const marcadorFinalizado = marcadorAtivo;
    const arrastou = houveArraste;
    marcadorFinalizado.classList.remove('dragging');
    marcadorAtivo = null;

    if (!arrastou) {
      abrirModal(marcadorFinalizado);
      return;
    }

    const id = marcadorFinalizado.dataset.id;
    const salvou = await salvarPosicao(id, posicaoSalva);

    if (!salvou) {
      marcadorFinalizado.style.outline = '2px solid #b64b4b';
      setTimeout(() => {
        marcadorFinalizado.style.outline = '';
      }, 1500);
    }
  }

  if (markersLayer) {
    markersLayer.addEventListener('pointerdown', iniciarArraste);
    markersLayer.addEventListener('pointermove', moverArraste);
    markersLayer.addEventListener('pointerup', finalizarArraste);
    markersLayer.addEventListener('pointercancel', finalizarArraste);
  }

  document.querySelectorAll('.tab').forEach((botao) => {
    botao.addEventListener('click', () => ativarAba(botao.dataset.tab));
  });

  if (modalBackdrop) {
    document
      .getElementById('caixaModalFechar')
      .addEventListener('click', fecharModal);

    modalBackdrop.addEventListener('click', (evento) => {
      if (evento.target === modalBackdrop) {
        fecharModal();
      }
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') {
        fecharModal();
      }
    });
  }
})();
