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

  function limitesDoPalco() {
    const palco = document.getElementById('mapStage');
    return palco.getBoundingClientRect();
  }

  function textoOu(valor, fallback) {
    const texto = String(valor || '').trim();
    return texto || fallback;
  }

  function abrirModal(marcador) {
    if (!modalBackdrop) {
      return;
    }

    const dados = marcador.dataset;

    document.getElementById('caixaModalTitulo').textContent =
      dados.codigo || 'Caixa';
    document.getElementById('caixaModalDescricao').textContent =
      textoOu(dados.descricao, 'Caixa técnica');
    document.getElementById('caixaModalLocalizacao').textContent =
      textoOu(dados.localizacao, 'Não informada');
    document.getElementById('caixaModalSwitch').textContent =
      textoOu(dados.switchNome, 'Não informado');
    document.getElementById('caixaModalIp').textContent =
      textoOu(dados.switchIp, 'Não informado');
    document.getElementById('caixaModalPortas').textContent =
      dados.switchPortas || '—';

    const totalCameras = Number(dados.totalCameras || 0);
    document.getElementById('caixaModalCameras').textContent =
      `${totalCameras} ${totalCameras === 1 ? 'câmera' : 'câmeras'}`;

    const painel = dados.fotoPainel ? 'painel' : null;
    const switchFoto = dados.fotoSwitch ? 'switch' : null;
    const fotos = [painel, switchFoto].filter(Boolean);
    document.getElementById('caixaModalFotos').textContent =
      fotos.length > 0
        ? `Foto do ${fotos.join(' e do ')} cadastrada`
        : 'Nenhuma foto cadastrada';

    modalBackdrop.classList.remove('hidden');
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
