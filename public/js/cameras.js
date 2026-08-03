(function () {
  const modalBackdrop = document.getElementById('cameraModalBackdrop');

  if (!modalBackdrop) {
    return;
  }

  const form = document.getElementById('cameraEditForm');
  const erroBox = document.getElementById('cameraModalErro');

  function abrirModal() {
    erroBox.classList.add('hidden');
    erroBox.textContent = '';
    modalBackdrop.classList.remove('hidden');
  }

  function fecharModal() {
    modalBackdrop.classList.add('hidden');
  }

  document.querySelectorAll('.btn-editar-camera').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const id = botao.dataset.id;

      try {
        const resposta = await fetch(`/cameras/${id}`);
        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
          throw new Error(dados.erro || 'Não foi possível carregar a câmera.');
        }

        const camera = dados.camera;
        document.getElementById('editId').value = camera.id;
        document.getElementById('editCaixaId').value = camera.caixa_id;
        document.getElementById('editPorta').value = camera.porta;
        document.getElementById('editNumero').value = camera.numero || '';
        document.getElementById('editNome').value = camera.nome || '';
        document.getElementById('editIp').value = camera.ip || '';
        document.getElementById('editLocalizacao').value = camera.localizacao || '';
        document.getElementById('editObservacoes').value = camera.observacoes || '';

        abrirModal();
      } catch (erro) {
        window.alert(erro.message || 'Não foi possível carregar a câmera.');
      }
    });
  });

  document.getElementById('cameraModalFechar').addEventListener('click', fecharModal);

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

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const id = document.getElementById('editId').value;

    const corpo = {
      caixa_id: Number(document.getElementById('editCaixaId').value),
      porta: Number(document.getElementById('editPorta').value),
      numero: document.getElementById('editNumero').value,
      nome: document.getElementById('editNome').value,
      ip: document.getElementById('editIp').value,
      localizacao: document.getElementById('editLocalizacao').value,
      observacoes: document.getElementById('editObservacoes').value,
    };

    try {
      const resposta = await fetch(`/cameras/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        throw new Error(dados.erro || 'Falha ao salvar.');
      }

      window.location.reload();
    } catch (erro) {
      erroBox.textContent = erro.message || 'Falha ao salvar.';
      erroBox.classList.remove('hidden');
    }
  });
})();
