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

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 3;
  const ZOOM_PASSO = 0.15;

  let zoomAtual = 1;
  let imagemLargura = 0;
  let imagemAltura = 0;

  function aplicarZoom(novoZoom) {
    zoomAtual = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, novoZoom));

    const sizer = document.getElementById('mapSizer');
    const stage = document.getElementById('mapStage');
    const label = document.getElementById('zoomLabel');

    if (!sizer || !stage || !imagemLargura) {
      return;
    }

    stage.style.width = `${imagemLargura}px`;
    stage.style.height = `${imagemAltura}px`;
    stage.style.transform = `scale(${zoomAtual})`;

    sizer.style.width = `${imagemLargura * zoomAtual}px`;
    sizer.style.height = `${imagemAltura * zoomAtual}px`;

    if (label) {
      label.textContent = `${Math.round(zoomAtual * 100)}%`;
    }
  }

  function inicializarZoom() {
    const imagem = document.getElementById('mapImage');

    if (!imagem) {
      return;
    }

    const configurar = () => {
      imagemLargura = imagem.naturalWidth;
      imagemAltura = imagem.naturalHeight;
      aplicarZoom(1);
    };

    if (imagem.complete && imagem.naturalWidth) {
      configurar();
    } else {
      imagem.addEventListener('load', configurar);
    }

    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomResetBtn = document.getElementById('zoomResetBtn');
    const viewport = document.getElementById('mapViewport');

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => aplicarZoom(zoomAtual + ZOOM_PASSO));
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => aplicarZoom(zoomAtual - ZOOM_PASSO));
    }

    if (zoomResetBtn) {
      zoomResetBtn.addEventListener('click', () => aplicarZoom(1));
    }

    if (viewport) {
      viewport.addEventListener(
        'wheel',
        (evento) => {
          if (!evento.ctrlKey) {
            return;
          }

          evento.preventDefault();
          const direcao = evento.deltaY < 0 ? 1 : -1;
          aplicarZoom(zoomAtual + direcao * ZOOM_PASSO);
        },
        { passive: false }
      );
    }
  }

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

    modalBackdrop.dataset.caixaId = id;
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

  async function trocarFoto(id, tipo, arquivo, elementoPreview) {
    const formData = new FormData();
    formData.append('foto', arquivo);

    const textoOriginal = elementoPreview.innerHTML;
    elementoPreview.textContent = 'Enviando…';

    try {
      const resposta = await fetch(`/caixas/${id}/foto/${tipo}`, {
        method: 'POST',
        body: formData,
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        throw new Error(dados.erro || 'Falha ao enviar foto.');
      }

      montarPreviewFoto(
        elementoPreview,
        dados.url,
        tipo === 'painel' ? 'Foto do painel' : 'Foto do switch'
      );
    } catch (erro) {
      elementoPreview.innerHTML = textoOriginal;
      window.alert('Não foi possível enviar a foto. Tente novamente.');
    }
  }

  function configurarTrocaDeFoto() {
    const inputPainel = document.getElementById('caixaModalTrocarPainel');
    const inputSwitch = document.getElementById('caixaModalTrocarSwitch');

    if (inputPainel) {
      inputPainel.addEventListener('change', () => {
        const arquivo = inputPainel.files[0];
        const id = document.getElementById('caixaModalBackdrop').dataset.caixaId;
        if (arquivo && id) {
          trocarFoto(
            id,
            'painel',
            arquivo,
            document.getElementById('caixaModalFotoPainel')
          );
        }
        inputPainel.value = '';
      });
    }

    if (inputSwitch) {
      inputSwitch.addEventListener('change', () => {
        const arquivo = inputSwitch.files[0];
        const id = document.getElementById('caixaModalBackdrop').dataset.caixaId;
        if (arquivo && id) {
          trocarFoto(
            id,
            'switch',
            arquivo,
            document.getElementById('caixaModalFotoSwitch')
          );
        }
        inputSwitch.value = '';
      });
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
    const x = (evento.clientX - retanguloPalco.left) / zoomAtual;
    const y = (evento.clientY - retanguloPalco.top) / zoomAtual;

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
    const x = (evento.clientX - retanguloPalco.left) / zoomAtual;
    const y = (evento.clientY - retanguloPalco.top) / zoomAtual;

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
    inicializarZoom();
    markersLayer.addEventListener('pointerdown', iniciarArraste);
    markersLayer.addEventListener('pointermove', moverArraste);
    markersLayer.addEventListener('pointerup', finalizarArraste);
    markersLayer.addEventListener('pointercancel', finalizarArraste);
  }

  document.querySelectorAll('.tab').forEach((botao) => {
    botao.addEventListener('click', () => ativarAba(botao.dataset.tab));
  });

  if (modalBackdrop) {
    configurarTrocaDeFoto();

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
