import {
  paraNumero, normalizarRascunho, catalogoParaPrompt, MARCADORES, CAMPOS_VALIDOS,
} from './extracao-pdf';

describe('leitura de laudo em PDF', () => {
  describe('paraNumero', () => {
    it.each([
      ['12,5', 12.5],
      ['1.234,56', 1234.56],
      ['4.5', 4.5],
      ['250', 250],
      ['0,08', 0.08],
    ])('"%s" → %f', (entrada, esperado) => {
      expect(paraNumero(entrada as string)).toBe(esperado);
    });

    it.each([
      ['7.500', 7500],
      ['1.234', 1234],
      ['250.000', 250000],
    ])('"%s" → %f (ponto com tres digitos e milhar)', (entrada, esperado) => {
      // Leucócitos "7.500" são sete mil e quinhentos, não sete e meio. A faixa
      // fisiológica pegaria o erro, mas depender da rede de segurança para um
      // caso previsível é ruim: nem todo marcador tem faixa apertada o bastante.
      expect(paraNumero(entrada as string)).toBe(esperado);
    });

    it('nao trata como milhar quando a parte inteira e zero', () => {
      // "0.500" só pode ser meio — não existe milhar começando em zero.
      expect(paraNumero('0.500')).toBe(0.5);
    });

    it('lê o formato brasileiro, não o americano', () => {
      // "4,5" tratado como formato americano viraria 45 — um TSH dez vezes
      // maior dentro do prontuário, sem nada que denuncie o erro.
      expect(paraNumero('4,5')).toBe(4.5);
      expect(paraNumero('4,5')).not.toBe(45);
    });

    it('ignora unidade colada no número', () => {
      expect(paraNumero('12,5 g/dL')).toBe(12.5);
    });

    it.each([['', null], ['—', null], ['indetectável', null], ['abc', null]])(
      '"%s" não vira número', (entrada, esperado) => {
        expect(paraNumero(entrada as string)).toBe(esperado);
      },
    );

    it('aceita número que já veio numérico', () => {
      expect(paraNumero(98.6)).toBe(98.6);
      expect(paraNumero(Number.NaN)).toBeNull();
    });
  });

  describe('normalizarRascunho', () => {
    const valor = (over: any = {}) => ({
      campo: 'hemoglobinGDl', valor: '13,5', unidade: 'g/dL',
      trecho: 'Hemoglobina .......... 13,5 g/dL', ...over,
    });

    it('aceita marcador conhecido', () => {
      const r = normalizarRascunho({ valores: [valor()] });
      expect(r.valores).toHaveLength(1);
      expect(r.valores[0].valor).toBe(13.5);
      expect(r.valores[0].suspeito).toBe(false);
    });

    it('mantém o trecho literal do laudo', () => {
      // Sem o trecho, conferir a extração significaria reler o PDF inteiro —
      // e aí a revisão vira carimbo.
      const r = normalizarRascunho({ valores: [valor()] });
      expect(r.valores[0].trecho).toContain('13,5 g/dL');
    });

    it('descarta campo que não existe na entidade', () => {
      // Campo inventado viraria erro de escrita no banco.
      const r = normalizarRascunho({ valores: [valor({ campo: 'colesterolMagico' })] });
      expect(r.valores).toHaveLength(0);
      expect(r.avisos.join(' ')).toMatch(/desconhecido/);
    });

    it('MARCA valor fora da faixa em vez de descartar', () => {
      // Descartar esconderia do profissional que o laudo tinha o marcador, e
      // ele não saberia que precisa digitar à mão.
      const r = normalizarRascunho({ valores: [valor({ valor: '135' })] });
      expect(r.valores).toHaveLength(1);
      expect(r.valores[0].suspeito).toBe(true);
      expect(r.valores[0].motivoSuspeita).toMatch(/erro de leitura/);
    });

    it('a suspeita fala de erro de leitura, não de saúde', () => {
      // O software não julga o resultado clínico; ele desconfia da própria
      // extração.
      const r = normalizarRascunho({ valores: [valor({ valor: '135' })] });
      expect(r.valores[0].motivoSuspeita).not.toMatch(/anemia|grave|alterado/i);
    });

    it('marcador repetido usa a primeira ocorrência e avisa', () => {
      const r = normalizarRascunho({
        valores: [valor({ valor: '13,5' }), valor({ valor: '11,0' })],
      });
      expect(r.valores).toHaveLength(1);
      expect(r.valores[0].valor).toBe(13.5);
      expect(r.avisos.join(' ')).toMatch(/mais de uma vez/);
    });

    it('valor ilegível vira aviso, não silêncio', () => {
      const r = normalizarRascunho({ valores: [valor({ valor: 'não realizado' })] });
      expect(r.valores).toHaveLength(0);
      expect(r.avisos.join(' ')).toMatch(/Não consegui ler/);
    });

    it('preserva o que a IA não soube mapear', () => {
      // Se sumisse, a profissional não saberia que o laudo trazia mais coisa.
      const r = normalizarRascunho({
        valores: [valor()],
        naoMapeados: [{ nome: 'Homocisteína', valor: '9,2 µmol/L', trecho: 'Homocisteína 9,2' }],
      });
      expect(r.naoMapeados).toHaveLength(1);
      expect(r.naoMapeados[0].nome).toBe('Homocisteína');
    });

    it('converte data brasileira para ISO', () => {
      const r = normalizarRascunho({ valores: [valor()], collectionDate: '15/03/2026' });
      expect(r.collectionDate).toBe('2026-03-15');
    });

    it('aceita data já em ISO', () => {
      const r = normalizarRascunho({ valores: [valor()], collectionDate: '2026-03-15' });
      expect(r.collectionDate).toBe('2026-03-15');
    });

    it('data irreconhecível vira aviso, e não uma data inventada', () => {
      const r = normalizarRascunho({ valores: [valor()], collectionDate: 'março de 2026' });
      expect(r.collectionDate).toBeNull();
      expect(r.avisos.join(' ')).toMatch(/Data de coleta não reconhecida/);
    });

    it('resposta vazia avisa que talvez não seja um laudo', () => {
      const r = normalizarRascunho({ valores: [] });
      expect(r.avisos.join(' ')).toMatch(/laudo laboratorial/);
    });

    it('entrada nula não quebra', () => {
      const r = normalizarRascunho(null);
      expect(r.valores).toEqual([]);
      expect(r.naoMapeados).toEqual([]);
    });

    it('corta texto absurdamente longo', () => {
      const r = normalizarRascunho({ valores: [valor({ trecho: 'x'.repeat(2000) })] });
      expect(r.valores[0].trecho.length).toBeLessThanOrEqual(300);
    });
  });

  describe('catálogo de marcadores', () => {
    it('não repete campo', () => {
      const campos = MARCADORES.map((m) => m.campo);
      expect(new Set(campos).size).toBe(campos.length);
    });

    it('todo marcador tem ao menos um nome e faixa coerente', () => {
      for (const m of MARCADORES) {
        expect(m.nomes.length).toBeGreaterThan(0);
        expect(m.min).toBeLessThan(m.max);
      }
    });

    it('o prompt lista todos os campos', () => {
      // Um marcador fora do prompt nunca seria extraído, e ninguém notaria:
      // pareceria que o laudo simplesmente não o tinha.
      const prompt = catalogoParaPrompt();
      for (const m of MARCADORES) expect(prompt).toContain(m.campo);
    });

    it('cobre os marcadores que aparecem em quase todo laudo', () => {
      for (const campo of [
        'hemoglobinGDl', 'fastingGlucoseMgDl', 'totalCholesterolMgDl',
        'tshUuiMl', 'creatinineMgDl', 'vitaminDNgMl', 'ferritinNgMl',
      ]) {
        expect(CAMPOS_VALIDOS.has(campo)).toBe(true);
      }
    });
  });
});
