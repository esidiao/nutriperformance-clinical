/**
 * Texto seguro para as fontes padrão do PDF.
 *
 * O DEFEITO QUE ISTO CONSERTA
 *
 * As fontes embutidas do PDF (helvetica, times, courier) usam
 * WinAnsiEncoding — a CP1252. Caractere fora dessa tabela NÃO vira um
 * quadradinho visível: ele corrompe a linha inteira. Medido:
 *
 *   entrada: "⚠ Documento de apoio profissional"
 *   saída:   "&    D o c u m e n t o   d e   a p o i o..."
 *
 * O símbolo virou "&" e o resto se desfez em espaçamento. Num relatório
 * clínico assinado, é uma linha ilegível no meio de um documento que a
 * profissional entrega ao paciente — e ninguém percebe ao escrever o código,
 * porque na tela o caractere aparece perfeito.
 *
 * POR QUE TRANSLITERAR, E NÃO APAGAR
 *
 * Apagar "≥" de "≥ 150 min/semana" produz "150 min/semana", que afirma outra
 * coisa. Cada símbolo vira o equivalente que preserva o sentido em ASCII.
 *
 * POR QUE ISTO NÃO É SÓ UMA LISTA DE SÍMBOLOS NOSSOS
 *
 * O texto do relatório inclui o que a profissional e o paciente digitaram:
 * nome, observação clínica, nome de alimento. Qualquer emoji colado numa
 * observação quebraria a linha do mesmo jeito. Por isso a limpeza é por
 * COBERTURA DA TABELA, não por lista de proibidos: o que não couber no
 * WinAnsi é tratado, venha de onde vier.
 */

/**
 * Os 27 caracteres que a CP1252 acrescenta no bloco 0x80–0x9F.
 *
 * Eles são válidos e NÃO devem ser transliterados: o travessão "—" e as
 * aspas curvas aparecem o tempo todo em texto em português.
 */
const EXTRAS_CP1252 = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

export function cabeNoWinAnsi(ch: string): boolean {
  const o = ch.codePointAt(0) ?? 0;
  return (
    (o >= 0x20 && o <= 0x7e)
    || (o >= 0xa0 && o <= 0xff)
    || EXTRAS_CP1252.has(o)
    || ch === '\n'
    || ch === '\t'
  );
}

/**
 * Equivalentes que preservam o sentido.
 *
 * Só entram aqui os que significam algo. Símbolo decorativo cai no
 * tratamento genérico e some, que é o certo: um emoji ausente não muda o
 * que o documento afirma.
 */
const EQUIVALENTE: Record<string, string> = {
  '→': '->', '⇒': '=>', '←': '<-', '↑': '+', '↓': '-',
  '≥': '>=', '≤': '<=', '≠': '!=', '≈': '~', '∞': 'infinito',
  '⚠': '!', '✓': 'OK', '✔': 'OK', '✗': 'X', '✘': 'X',
  '●': '-', '▪': '-', '─': '-', '━': '-', '│': '|', '█': ' ',
  '​': '', '‌': '', '‍': '', '﻿': '', // invisíveis
};

/**
 * NÃO ENTRAM AQUI, porque a CP1252 os tem e eles saem perfeitos:
 *
 *   ×  ÷  ±  ·  •  –  —  «  »  ½  ¼  ¾  …  “ ” ‘ ’  e o espaço inquebrável
 *
 * Eu tinha posto vários deles no mapa por precaução, e o teste mostrou que
 * eram entradas mortas: nunca eram alcançadas, porque `cabeNoWinAnsi` já os
 * aprovava antes. Pior: se fossem alcançadas, trocariam "peso × altura" por
 * "peso x altura" sem necessidade. Transliterar o que não precisa também é
 * alterar o documento.
 */

/**
 * Letras latinas que o NFD NÃO decompõe.
 *
 * "Ł" não é "L" mais um acento combinante — é um ponto de código próprio,
 * com o traço embutido. Normalizar não o separa, então sem este mapa a letra
 * sumia inteira e "Łukasz" virava "ukasz", comendo a inicial do nome de uma
 * pessoa. O mesmo vale para Đ, Ħ, Ŧ e Ø maiúsculo de alguns teclados.
 */
const LETRA_SEM_DECOMPOSICAO: Record<string, string> = {
  'Ł': 'L', 'ł': 'l', 'Đ': 'D', 'đ': 'd', 'Ħ': 'H', 'ħ': 'h',
  'Ŧ': 'T', 'ŧ': 't', 'Ŋ': 'N', 'ŋ': 'n', 'Ə': 'E', 'ə': 'e',
  'Æ': 'AE', 'æ': 'ae', 'Œ': 'OE', 'œ': 'oe', 'ß': 'ss',
};

/**
 * Converte um texto para algo que as fontes padrão do PDF saibam escrever.
 *
 * A ordem importa: primeiro o equivalente com significado, depois a
 * decomposição que tira acento de letra que a CP1252 não tem (ă, ș, ł), e só
 * então o descarte. Descartar antes da decomposição transformaria "Gheorghiță"
 * em "Gheorghi", perdendo uma letra em vez de perder só o acento.
 */
export function paraWinAnsi(entrada: string): string {
  let saida = '';

  // Array.from itera por PONTO DE CODIGO, nao por unidade UTF-16: um emoji
  // e um caractere so, e nao dois meios-pares que sairiam separados.
  for (const ch of Array.from(entrada)) {
    if (cabeNoWinAnsi(ch)) {
      saida += ch;
      continue;
    }

    const equivalente = EQUIVALENTE[ch];
    if (equivalente !== undefined) {
      saida += equivalente;
      continue;
    }

    const letra = LETRA_SEM_DECOMPOSICAO[ch];
    if (letra !== undefined) {
      saida += letra;
      continue;
    }

    // Letra acentuada fora da CP1252: fica a letra, sem o acento.
    const decomposto = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (decomposto !== ch && Array.from(decomposto).every(cabeNoWinAnsi)) {
      saida += decomposto;
      continue;
    }

    // Resto (emoji, ideograma, símbolo decorativo): sai.
    // Não vira "?" porque uma fileira de interrogações num laudo parece
    // defeito de dado, e some sem alterar o que o documento afirma.
  }

  return saida;
}

/**
 * Qualquer valor que vá para o PDF, em texto seguro.
 *
 * Mantém a proteção contra injeção que já existia (bytes nulos e controles)
 * e acrescenta a cobertura do WinAnsi.
 */
export function textoPdf(valor: unknown, maxLen = 200): string {
  if (valor === null || valor === undefined) return '';
  const bruto = typeof valor === 'string' ? valor : String(valor);
  // eslint-disable-next-line no-control-regex
  const semControles = bruto.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return paraWinAnsi(semControles).slice(0, maxLen);
}

/** O mínimo que um documento precisa expor para ser protegido. */
export interface DocumentoProtegivel {
  text: (texto: unknown, x: number, y: number, ...resto: unknown[]) => unknown;
}

/**
 * Envolve `doc.text` para que NENHUMA chamada escape da limpeza.
 *
 * Este é o ponto que faz o conserto durar. Limpar em cada chamada funciona
 * no dia em que se escreve e falha na próxima linha que alguém acrescentar —
 * havia 31 chamadas de `doc.text` e 20 de limpeza, ou seja, onze já estavam
 * desprotegidas. Aqui a proteção não depende de ninguém lembrar.
 */
export function protegerDocumento<T extends DocumentoProtegivel>(doc: T): T {
  const original = doc.text.bind(doc);

  doc.text = ((texto: unknown, x: number, y: number, ...resto: unknown[]) => {
    if (Array.isArray(texto)) {
      return original(texto.map((t) => paraWinAnsi(String(t))), x, y, ...resto);
    }
    return original(paraWinAnsi(String(texto ?? '')), x, y, ...resto);
  }) as T['text'];

  return doc;
}

/** Limpa as linhas de uma tabela do autoTable, que desenha por fora. */
export function linhasPdf(linhas: unknown[][], maxLen = 200): string[][] {
  return linhas.map((linha) => linha.map((celula) => textoPdf(celula, maxLen)));
}
