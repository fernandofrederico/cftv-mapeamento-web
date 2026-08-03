(function () {
  const botao = document.getElementById('gerarRelatorioBtn');
  const status = document.getElementById('relatorioStatus');

  if (!botao) {
    return;
  }

  botao.addEventListener('click', async () => {
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Gerando relatório…';
    status.textContent = 'Isso pode levar alguns segundos, dependendo da quantidade de fotos.';

    try {
      const resposta = await fetch('/documentos/relatorio', { method: 'POST' });

      if (!resposta.ok) {
        throw new Error('Falha ao gerar o relatório.');
      }

      const blob = await resposta.blob();

      const cabecalho = resposta.headers.get('Content-Disposition') || '';
      const match = cabecalho.match(/filename="(.+)"/);
      const nomeArquivo = match ? match[1] : 'Relatorio_CFTV.docx';

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      status.textContent = 'Relatório gerado e baixado com sucesso.';
    } catch (erro) {
      status.textContent = 'Não foi possível gerar o relatório. Tente novamente.';
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  });
})();
