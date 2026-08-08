const fs = require('fs');
const path = require('path');

const express = require('express');
const { imageSize } = require('image-size');
const { Jimp, loadFont, measureText } = require('jimp');
const jimpFonts = require('jimp/fonts');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  AlignmentType,
  PageOrientation,
  BorderStyle,
  ShadingType,
  VerticalAlign,
} = require('docx');

const { requireAuth } = require('../middlewares/auth');
const { getDatabasePool } = require('../config/database');

const router = express.Router();

const COR_PRIMARIA = '2D78AD';
const COR_TITULO = '20384B';
const PASTA_FOTOS_ESTATICAS = path.join(
  __dirname,
  '..',
  '..',
  'public'
);

const BORDA_FINA = {
  style: BorderStyle.SINGLE,
  size: 2,
  color: 'C9D5DE',
};

const BORDAS_CELULA = {
  top: BORDA_FINA,
  bottom: BORDA_FINA,
  left: BORDA_FINA,
  right: BORDA_FINA,
};

function paragrafoSimples(texto, opcoes) {
  return new Paragraph({
    children: [new TextRun({ text: String(texto ?? '—'), ...opcoes })],
  });
}

function celula(texto, { cabecalho = false, largura } = {}) {
  return new TableCell({
    width: largura ? { size: largura, type: WidthType.PERCENTAGE } : undefined,
    shading: cabecalho
      ? { type: ShadingType.CLEAR, fill: COR_PRIMARIA }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: BORDAS_CELULA,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      paragrafoSimples(texto, {
        bold: cabecalho,
        color: cabecalho ? 'FFFFFF' : undefined,
        size: 18,
      }),
    ],
  });
}

function criarTabela(colunas, linhas, larguras) {
  const linhaCabecalho = new TableRow({
    tableHeader: true,
    children: colunas.map((coluna, indice) =>
      celula(coluna, { cabecalho: true, largura: larguras?.[indice] })
    ),
  });

  const linhasDados = linhas.map(
    (linha) =>
      new TableRow({
        children: linha.map((valor, indice) =>
          celula(valor, { largura: larguras?.[indice] })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [linhaCabecalho, ...linhasDados],
  });
}

function tituloSecao(texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { before: 0, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: COR_PRIMARIA, space: 6 },
    },
    children: [new TextRun({ text: texto, color: COR_TITULO, bold: true })],
  });
}

function subtitulo(texto, { novaPagina = false } = {}) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    pageBreakBefore: novaPagina,
    spacing: { before: 260, after: 100 },
    children: [new TextRun({ text: texto, color: COR_PRIMARIA, bold: true, size: 22 })],
  });
}

function detectarTipoImagem(buffer) {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'png';
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }

  if (buffer.slice(0, 3).toString('ascii') === 'GIF') {
    return 'gif';
  }

  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return 'bmp';
  }

  return null; // ex.: webp — não suportado pela biblioteca de geração do Word
}

function dimensionarImagem(buffer, larguraMaxPx, alturaMaxPx) {
  try {
    const dimensoes = imageSize(buffer);
    const proporcao = dimensoes.width / dimensoes.height;

    let largura = larguraMaxPx;
    let altura = largura / proporcao;

    if (altura > alturaMaxPx) {
      altura = alturaMaxPx;
      largura = altura * proporcao;
    }

    return { width: Math.round(largura), height: Math.round(altura) };
  } catch {
    return { width: larguraMaxPx, height: alturaMaxPx };
  }
}

function imagemParagrafo(buffer, larguraMaxPx, alturaMaxPx) {
  const tipo = detectarTipoImagem(buffer);

  if (!tipo) {
    return paragrafoSimples(
      'Imagem em formato não suportado para o relatório (envie em JPG ou PNG).',
      { italics: true, color: '9C3030', size: 18 }
    );
  }

  const { width, height } = dimensionarImagem(buffer, larguraMaxPx, alturaMaxPx);

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new ImageRun({
        data: buffer,
        transformation: { width, height },
        type: tipo,
      }),
    ],
  });
}

const SEM_BORDA = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const SEM_BORDAS_CELULA = {
  top: SEM_BORDA,
  bottom: SEM_BORDA,
  left: SEM_BORDA,
  right: SEM_BORDA,
};

function celulaFoto(legenda, buffer) {
  const conteudo = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: legenda, italics: true, size: 18, color: '4A5C6A' })],
    }),
  ];

  conteudo.push(
    buffer
      ? imagemParagrafo(buffer, 420, 300)
      : paragrafoSimples('Sem foto cadastrada', { italics: true, size: 18, color: '9C3030' })
  );

  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: SEM_BORDAS_CELULA,
    children: conteudo,
  });
}

function linhaFotos(fotoPainel, fotoSwitch) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: SEM_BORDA, bottom: SEM_BORDA, left: SEM_BORDA, right: SEM_BORDA,
      insideHorizontal: SEM_BORDA, insideVertical: SEM_BORDA,
    },
    rows: [
      new TableRow({
        children: [
          celulaFoto('Foto do painel', fotoPainel),
          celulaFoto('Foto do switch', fotoSwitch),
        ],
      }),
    ],
  });
}

function lerFotoEstatica(caminhoWeb) {
  if (!caminhoWeb || !caminhoWeb.startsWith('/')) {
    return null;
  }

  const caminhoAbsoluto = path.join(PASTA_FOTOS_ESTATICAS, caminhoWeb);

  try {
    return fs.readFileSync(caminhoAbsoluto);
  } catch {
    return null;
  }
}

async function desenharMarcadoresNoMapa(bufferMapa, caixas) {
  const tipoSuportado = detectarTipoImagem(bufferMapa);

  if (!tipoSuportado || caixas.length === 0) {
    return bufferMapa;
  }

  try {
    const mapa = await Jimp.read(bufferMapa);
    const fonte = await loadFont(jimpFonts.SANS_16_BLACK);

    const RAIO = 15;
    const COR_MARCADOR = 0x2d78adff;
    const COR_BORDA = 0xffffffff;
    const COR_FUNDO_LABEL = 0xffffffe6;

    caixas.forEach((caixa) => {
      const x = Number(caixa.pos_x);
      const y = Number(caixa.pos_y);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }

      const tamanho = RAIO * 2 + 6;
      const marcador = new Jimp({ width: tamanho, height: tamanho, color: 0x00000000 });

      for (let yy = 0; yy < tamanho; yy += 1) {
        for (let xx = 0; xx < tamanho; xx += 1) {
          const dx = xx - tamanho / 2;
          const dy = yy - tamanho / 2;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= RAIO + 3) {
            marcador.setPixelColor(COR_BORDA, xx, yy);
          }
          if (dist <= RAIO) {
            marcador.setPixelColor(COR_MARCADOR, xx, yy);
          }
        }
      }

      mapa.composite(marcador, x - tamanho / 2, y - tamanho / 2);

      const texto = String(caixa.codigo || '');
      const larguraTexto = measureTextSeguro(fonte, texto);
      const labelX = Math.round(x - larguraTexto / 2 - 5);
      const labelY = Math.round(y + RAIO + 4);
      const labelW = larguraTexto + 10;
      const labelH = 20;

      for (let yy = 0; yy < labelH; yy += 1) {
        for (let xx = 0; xx < labelW; xx += 1) {
          mapa.setPixelColor(COR_FUNDO_LABEL, labelX + xx, labelY + yy);
        }
      }

      mapa.print({ font: fonte, x: labelX + 5, y: labelY + 1, text: texto });
    });

    const tipoSaida = tipoSuportado === 'jpg' ? 'image/jpeg' : `image/${tipoSuportado}`;
    return await mapa.getBuffer(tipoSaida);
  } catch {
    return bufferMapa;
  }
}

function measureTextSeguro(fonte, texto) {
  try {
    return measureText(fonte, texto);
  } catch {
    return texto.length * 9;
  }
}

router.get('/documentos', requireAuth, (req, res) => {
  res.render('documentos', {
    titulo: 'Documentos',
    usuario: req.session.usuario,
    erro: req.query.erro || null,
  });
});

router.post('/documentos/relatorio', requireAuth, async (req, res, next) => {
  try {
    const pool = getDatabasePool();

    const [caixas] = await pool.query(`
      SELECT id, codigo, descricao, localizacao, switch_nome, switch_ip, switch_portas,
             foto_painel, foto_switch, foto_painel_dados, foto_switch_dados,
             pos_x, pos_y
      FROM caixas
      ORDER BY codigo
    `);

    const [cameras] = await pool.query(`
      SELECT camera.caixa_id, camera.porta, camera.numero, camera.nome,
             camera.ip, camera.localizacao, camera.observacoes,
             caixa.codigo AS caixa_codigo
      FROM cameras AS camera
      INNER JOIN caixas AS caixa ON caixa.id = camera.caixa_id
      ORDER BY caixa.codigo, camera.porta
    `);

    const [nodes] = await pool.query(
      'SELECT id, node_type, label, pos_x, pos_y, size FROM diagram_nodes ORDER BY id'
    );

    const [links] = await pool.query(`
      SELECT l.line_width, l.line_color, l.line_style,
             a.label AS origem, b.label AS destino
      FROM diagram_links AS l
      INNER JOIN diagram_nodes AS a ON a.id = l.start_node_id
      INNER JOIN diagram_nodes AS b ON b.id = l.end_node_id
      ORDER BY l.id
    `);

    const [mapaLinhas] = await pool.query(
      'SELECT imagem_dados FROM mapa_config WHERE id = 1'
    );
    const imagemMapa = mapaLinhas[0]?.imagem_dados || null;

    const rotulosTipoNo = {
      switch: 'Switch',
      box: 'Caixa técnica',
      rack: 'Rack/Data Center',
      server: 'Servidor',
      router: 'Roteador',
      cloud: 'Nuvem/Internet',
      text: 'Texto',
    };

    const conteudo = [];
    let numeroSecao = 0;
    const proximoNumero = () => {
      numeroSecao += 1;
      return numeroSecao;
    };

    // ---------- Capa ----------
    conteudo.push(
      new Paragraph({ spacing: { before: 1600 }, children: [] }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'RELATÓRIO TÉCNICO',
            bold: true,
            size: 20,
            color: COR_PRIMARIA,
            characterSpacing: 40,
          }),
        ],
      }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 0 },
        children: [
          new TextRun({
            text: 'Infraestrutura de CFTV',
            bold: true,
            size: 60,
            color: COR_TITULO,
          }),
        ],
      }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 220, after: 0 },
        children: [
          new TextRun({
            text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            color: COR_PRIMARIA,
            size: 18,
          }),
        ],
      }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 220, after: 0 },
        children: [
          new TextRun({
            text: 'Mapeamento de caixas técnicas, câmeras, switches e diagrama de rede',
            size: 24,
            color: '5A6C78',
            italics: true,
          }),
        ],
      }),

      new Paragraph({ spacing: { before: 1000 }, children: [] }),

      criarTabela(
        ['Indicador', 'Quantidade'],
        [
          ['Caixas técnicas mapeadas', String(caixas.length)],
          ['Câmeras cadastradas', String(cameras.length)],
          ['Equipamentos no diagrama', String(nodes.length)],
          ['Ligações no diagrama', String(links.length)],
        ],
        [70, 30]
      ),

      new Paragraph({ spacing: { before: 800 }, children: [] }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Gerado em ${new Date().toLocaleString('pt-BR')}`,
            size: 20,
            color: '5A6C78',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `por ${req.session.usuario.nome}`,
            size: 20,
            color: '5A6C78',
          }),
        ],
      })
    );

    // ---------- Resumo ----------
    conteudo.push(tituloSecao(`${proximoNumero()}. Resumo geral`));
    conteudo.push(
      criarTabela(
        ['Indicador', 'Quantidade'],
        [
          ['Caixas técnicas', String(caixas.length)],
          ['Câmeras cadastradas', String(cameras.length)],
          ['Equipamentos no diagrama', String(nodes.length)],
          ['Ligações no diagrama', String(links.length)],
        ],
        [70, 30]
      )
    );

    // ---------- Mapa ----------
    if (imagemMapa) {
      conteudo.push(tituloSecao(`${proximoNumero()}. Mapa geral`));
      const mapaComMarcadores = await desenharMarcadoresNoMapa(imagemMapa, caixas);
      conteudo.push(imagemParagrafo(mapaComMarcadores, 900, 560));
    }

    // ---------- Caixas técnicas ----------
    conteudo.push(tituloSecao(`${proximoNumero()}. Caixas técnicas`));

    caixas.forEach((caixa, indice) => {
      conteudo.push(
        subtitulo(`${caixa.codigo} — ${caixa.descricao || 'Caixa técnica'}`, {
          novaPagina: indice > 0,
        })
      );
      conteudo.push(
        criarTabela(
          ['Localização', 'Switch', 'IP do switch', 'Portas'],
          [[
            caixa.localizacao || '—',
            caixa.switch_nome || '—',
            caixa.switch_ip || '—',
            String(caixa.switch_portas),
          ]],
          [40, 30, 20, 10]
        )
      );

      const fotoPainel =
        caixa.foto_painel_dados || lerFotoEstatica(caixa.foto_painel);
      const fotoSwitch =
        caixa.foto_switch_dados || lerFotoEstatica(caixa.foto_switch);

      if (fotoPainel || fotoSwitch) {
        conteudo.push(linhaFotos(fotoPainel, fotoSwitch));
      }
    });

    // ---------- Câmeras ----------
    conteudo.push(tituloSecao(`${proximoNumero()}. Câmeras por porta`));
    conteudo.push(
      criarTabela(
        ['Caixa', 'Porta', 'Número', 'Descrição', 'IP', 'Localização', 'Observações'],
        cameras.map((c) => [
          c.caixa_codigo,
          String(c.porta).padStart(2, '0'),
          c.numero || '—',
          c.nome || '—',
          c.ip || '—',
          c.localizacao || '—',
          c.observacoes || '—',
        ]),
        [10, 8, 12, 25, 15, 15, 15]
      )
    );

    // ---------- Diagrama ----------
    conteudo.push(tituloSecao(`${proximoNumero()}. Equipamentos do diagrama`));
    if (nodes.length === 0) {
      conteudo.push(paragrafoSimples('Nenhum equipamento cadastrado no diagrama.'));
    } else {
      conteudo.push(
        criarTabela(
          ['Tipo', 'Descrição', 'Tamanho'],
          nodes.map((n) => [
            rotulosTipoNo[n.node_type] || n.node_type,
            n.label || '—',
            String(n.size),
          ]),
          [30, 50, 20]
        )
      );
    }

    conteudo.push(tituloSecao(`${proximoNumero()}. Ligações do diagrama`));
    if (links.length === 0) {
      conteudo.push(paragrafoSimples('Nenhuma ligação cadastrada no diagrama.'));
    } else {
      conteudo.push(
        criarTabela(
          ['Origem', 'Destino', 'Espessura', 'Cor', 'Estilo'],
          links.map((l) => [
            l.origem || '—',
            l.destino || '—',
            String(l.line_width),
            l.line_color,
            l.line_style,
          ]),
          [30, 30, 13, 14, 13]
        )
      );
    }

    const documento = new Document({
      sections: [
        {
          properties: {
            page: {
              size: { orientation: PageOrientation.LANDSCAPE },
              margin: { top: 720, bottom: 720, left: 720, right: 720 },
            },
          },
          children: conteudo,
        },
      ],
    });

    const buffer = await Packer.toBuffer(documento);
    const dataArquivo = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[-:]/g, '')
      .replace('T', '_');

    res.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.set(
      'Content-Disposition',
      `attachment; filename="Relatorio_CFTV_${dataArquivo}.docx"`
    );
    return res.send(buffer);
  } catch (erro) {
    return next(erro);
  }
});

module.exports = router;
