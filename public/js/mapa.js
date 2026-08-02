(function () {
  const markersLayer = document.getElementById('markersLayer');

  if (!markersLayer) {
    return;
  }

  let marcadorAtivo = null;
  let offsetX = 0;
  let offsetY = 0;
  let posicaoSalva = { x: 0, y: 0 };

  function limitesDoPalco() {
    const palco = document.getElementById('mapStage');
    return palco.getBoundingClientRect();
  }

  function iniciarArraste(evento) {
    const marcador = evento.target.closest('.marker');

    if (!marcador) {
      return;
    }

    marcadorAtivo = marcador;
    marcadorAtivo.classList.add('dragging');
    marcadorAtivo.setPointerCapture(evento.pointerId);

    const retanguloPalco = limitesDoPalco();
    const x = evento.clientX - retanguloPalco.left;
    const y = evento.clientY - retanguloPalco.top;

    offsetX = x - parseFloat(marcadorAtivo.style.left || '0');
    offsetY = y - parseFloat(marcadorAtivo.style.top || '0');
  }

  function moverArraste(evento) {
    if (!marcadorAtivo) {
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

  async function finalizarArraste(evento) {
    if (!marcadorAtivo) {
      return;
    }

    marcadorAtivo.classList.remove('dragging');

    const id = marcadorAtivo.dataset.id;
    const marcadorFinalizado = marcadorAtivo;
    marcadorAtivo = null;

    try {
      const resposta = await fetch(`/mapa/caixas/${id}/posicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pos_x: posicaoSalva.x,
          pos_y: posicaoSalva.y,
        }),
      });

      if (!resposta.ok) {
        throw new Error('Falha ao salvar posição.');
      }
    } catch (erro) {
      marcadorFinalizado.style.outline = '2px solid #b64b4b';
      setTimeout(() => {
        marcadorFinalizado.style.outline = '';
      }, 1500);
    }
  }

  markersLayer.addEventListener('pointerdown', iniciarArraste);
  markersLayer.addEventListener('pointermove', moverArraste);
  markersLayer.addEventListener('pointerup', finalizarArraste);
  markersLayer.addEventListener('pointercancel', finalizarArraste);
})();
