import {
  paraWinAnsi, textoPdf, cabeNoWinAnsi, protegerDocumento, linhasPdf,
  type DocumentoProtegivel,
} from '../../../../web/lib/pdf/texto-seguro';

/**
 * O defeito que estes testes travam foi relatado em produção: relatórios em
 * PDF saindo com caracteres estranhos.
 *
 * A causa não é "falta um glifo". As fontes padrão do PDF usam
 * WinAnsiEncoding, e um caractere fora dessa tabela CORROMPE A LINHA
 * INTEIRA. Medido antes do conserto, gerando o PDF e lendo de volta:
 *
 *   entrada: "⚠ Documento de apoio profissional"
 *   saída:   "&    D o c u m e n t o   d e   a p o i o..."
 *
 * Nenhum erro, nenhum aviso. A linha simplesmente deixa de ser legível num
 * documento que a profissional assina e entrega ao paciente.
 */
describe('texto seguro para PDF', () => {
  describe('o que PRECISA passar intacto', () => {
    it('todo o português acentuado', () => {
      // Se isto quebrar, o conserto virou um defeito pior que o original.
      const texto = 'Avaliação Nutricional — João Gonçalves, três refeições, '
        + 'maçã, açúcar, água, pêssego, lipídios, proteína, Nº 1, ÁÉÍÓÚÃÕÇ';
      expect(paraWinAnsi(texto)).toBe(texto);
    });

    it('travessão, aspas curvas e reticências, que a CP1252 tem', () => {
      // Estão no bloco 0x80–0x9F e são comuns em texto em português.
      for (const ch of ['—', '–', '“', '”', '‘', '’', '…', '™', '€']) {
        expect(cabeNoWinAnsi(ch)).toBe(true);
        expect(paraWinAnsi(`a${ch}b`)).toBe(`a${ch}b`);
      }
    });

    it('quebra de linha e tabulação', () => {
      expect(paraWinAnsi('linha 1\nlinha 2\tcoluna')).toBe('linha 1\nlinha 2\tcoluna');
    });
  });

  describe('o que precisa ser traduzido, não apagado', () => {
    it('símbolos que carregam significado viram o equivalente', () => {
      // Apagar o ">=" de ">= 150 min/semana" produz "150 min/semana", que
      // afirma outra coisa. Esta é a diferença entre limpar e mentir.
      expect(paraWinAnsi('≥ 150 min/semana')).toBe('>= 150 min/semana');
      expect(paraWinAnsi('≤ 2,3 g de sódio')).toBe('<= 2,3 g de sódio');
      expect(paraWinAnsi('Café → almoço')).toBe('Café -> almoço');
      expect(paraWinAnsi('≠ do habitual')).toBe('!= do habitual');
    });

    it('o símbolo de alerta não some sem deixar marca', () => {
      expect(paraWinAnsi('⚠ Interações')).toBe('! Interações');
      expect(paraWinAnsi('✓ Conferido')).toBe('OK Conferido');
    });

    it('letra acentuada fora da CP1252 perde o acento, não a letra', () => {
      // Apagar antes de decompor transformaria "Gheorghiță" em "Gheorghi",
      // comendo uma letra do nome de um paciente.
      expect(paraWinAnsi('Gheorghiță')).toBe('Gheorghita');
      expect(paraWinAnsi('Łukasz')).toBe('Lukasz');
      expect(paraWinAnsi('Ştefan')).toBe('Stefan');
    });

    it('emoji e decoração sumem sem alterar o que o texto afirma', () => {
      // Uma fileira de "?" num laudo parece defeito de dado.
      expect(paraWinAnsi('Meta atingida 🎉')).toBe('Meta atingida ');
      expect(paraWinAnsi('見る')).toBe('');
      expect(paraWinAnsi('a🏃‍♀️b')).toBe('ab');
    });

    it('invisíveis colados de outro editor somem', () => {
      expect(paraWinAnsi('pa​ciente')).toBe('paciente');
      expect(paraWinAnsi('﻿Nome')).toBe('Nome');
    });

    it('o que a CP1252 TEM passa intacto, em vez de ser traduzido à toa', () => {
      // Eu tinha posto varios destes no mapa de equivalentes por precaucao.
      // Eram entradas mortas, e se fossem alcancadas trocariam
      // "peso × altura" por "peso x altura" sem necessidade. O teste real
      // de geracao provou que todos saem perfeitos.
      for (const ch of ['×', '÷', '±', '·', '•', '«', '»', '½', '¼', '¾', ' ']) {
        expect(cabeNoWinAnsi(ch)).toBe(true);
        expect(paraWinAnsi(`a${ch}b`)).toBe(`a${ch}b`);
      }
    });
  });

  describe('textoPdf', () => {
    it('continua removendo bytes nulos e controles', () => {
      expect(textoPdf('no\u0000me\u0007')).toBe('nome');
    });

    it('respeita o limite de tamanho', () => {
      expect(textoPdf('x'.repeat(500), 10)).toHaveLength(10);
    });

    it('nulo e indefinido viram vazio, não "null"', () => {
      // "Paciente: null" impresso num laudo é pior que o campo em branco.
      expect(textoPdf(null)).toBe('');
      expect(textoPdf(undefined)).toBe('');
    });

    it('número vira texto sem virar vazio', () => {
      expect(textoPdf(1850)).toBe('1850');
      expect(textoPdf(0)).toBe('0');
    });
  });

  describe('protegerDocumento', () => {
    it('limpa toda chamada de texto, mesmo quem esqueceu de limpar', () => {
      // Esta é a razão de existir: havia 31 chamadas de doc.text e 20 de
      // limpeza. Onze estavam desprotegidas, e a próxima linha que alguém
      // acrescentasse estaria também.
      const recebidas: unknown[] = [];
      const falso: DocumentoProtegivel = {
        text: (t: unknown) => { recebidas.push(t); return undefined; },
      };
      const doc = protegerDocumento(falso);

      doc.text('⚠ Alerta', 0, 0);
      doc.text('≥ 150 min', 0, 0);
      doc.text('Avaliação — João', 0, 0);

      expect(recebidas).toEqual(['! Alerta', '>= 150 min', 'Avaliação — João']);
    });

    it('trata o formato de array, que o jsPDF aceita para várias linhas', () => {
      const recebidas: unknown[] = [];
      const doc = protegerDocumento<DocumentoProtegivel>({
        text: (t: unknown) => { recebidas.push(t); return undefined; },
      });
      doc.text(['⚠ um', 'dois →'], 0, 0);
      expect(recebidas[0]).toEqual(['! um', 'dois ->']);
    });

    it('repassa as coordenadas e as opções sem mexer', () => {
      const chamada: unknown[] = [];
      const doc = protegerDocumento<DocumentoProtegivel>({
        text: (...args: unknown[]) => { chamada.push(...args); return undefined; },
      });
      doc.text('texto', 15, 20, { align: 'right' } as never);
      expect(chamada).toEqual(['texto', 15, 20, { align: 'right' }]);
    });

    it('nulo não vira a palavra "null" na página', () => {
      const recebidas: unknown[] = [];
      const doc = protegerDocumento<DocumentoProtegivel>({
        text: (t: unknown) => { recebidas.push(t); return undefined; },
      });
      doc.text(null as never, 0, 0);
      expect(recebidas[0]).toBe('');
    });
  });

  describe('linhasPdf', () => {
    it('limpa as células da tabela, que o autoTable desenha por fora', () => {
      expect(linhasPdf([['Arroz ⚠', '100 g', '→ integral'], [null, 50, undefined]]))
        .toEqual([['Arroz !', '100 g', '-> integral'], ['', '50', '']]);
    });
  });

  describe('a cobertura é por tabela, não por lista de proibidos', () => {
    it('qualquer ponto de código fora do WinAnsi é tratado', () => {
      // O texto do relatório inclui o que a profissional e o paciente
      // digitaram. Uma lista de símbolos conhecidos deixaria passar o
      // próximo caractere que ninguém previu.
      for (let cp = 0x100; cp < 0x3000; cp += 7) {
        const ch = String.fromCodePoint(cp);
        if (cabeNoWinAnsi(ch)) continue;
        const saida = paraWinAnsi(ch);
        expect([...saida].every(cabeNoWinAnsi)).toBe(true);
      }
    });

    it('o resultado NUNCA contém caractere que a fonte não saiba escrever', () => {
      const sujo = '⚠ Paciente: Gheorghiță 🎉 ≥150min · café→almoço 見る​';
      const limpo = paraWinAnsi(sujo);
      expect([...limpo].every(cabeNoWinAnsi)).toBe(true);
      expect(limpo).toBe('! Paciente: Gheorghita  >=150min · café->almoço ');
    });
  });
});
