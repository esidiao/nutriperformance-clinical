import { avaliarAdequacao, resumir } from '../../../../web/lib/adequacao';
import { referenciaDe, faixaDaIdade, CDRR_SODIO } from '../../../../web/lib/referencia-dri';

/**
 * O motor de adequação decide como LER cada resultado, e é aí que mora o risco
 * clínico — não na aritmética. Quatro situações parecem a mesma coisa num
 * percentual e não são:
 *
 *   abaixo de RDA ≠ abaixo de AI ≠ acima do UL ≠ sem dado na base
 *
 * Estes testes travam a distinção.
 */
const linha = (r: ReturnType<typeof avaliarAdequacao>, nutriente: string) =>
  r.linhas.find((l) => l.nutriente === nutriente)!;

describe('adequação nutricional', () => {
  describe('faixa etária', () => {
    it('classifica as quatro faixas adultas', () => {
      expect(faixaDaIdade(25)).toBe('19-30');
      expect(faixaDaIdade(45)).toBe('31-50');
      expect(faixaDaIdade(65)).toBe('51-70');
      expect(faixaDaIdade(80)).toBe('70+');
    });

    it('abaixo de 19 anos devolve null — a tabela carregada é a de adultos', () => {
      // Aplicar valor de adulto a adolescente seria pior que não avaliar.
      expect(faixaDaIdade(15)).toBeNull();
    });

    it('sem faixa, o relatório sai vazio em vez de usar valores de adulto', () => {
      const r = avaliarAdequacao({ calcioMg: 800 }, 15, 'male');
      expect(r.linhas).toEqual([]);
      expect(r.faixa).toBeNull();
    });
  });

  describe('a recomendação muda por sexo e idade', () => {
    it('ferro: 18 mg para mulher de 25, 8 mg para mulher de 60', () => {
      // Era exatamente o que a RDC 269/2005 não fazia, e o motivo da troca.
      const jovem = avaliarAdequacao({ ferroMg: 10 }, 25, 'female');
      const idosa = avaliarAdequacao({ ferroMg: 10 }, 60, 'female');
      expect(linha(jovem, 'ferroMg').recomendado).toBe(18);
      expect(linha(idosa, 'ferroMg').recomendado).toBe(8);
    });

    it('as mesmas 10 mg de ferro: inadequadas aos 25, adequadas aos 60', () => {
      expect(linha(avaliarAdequacao({ ferroMg: 10 }, 25, 'female'), 'ferroMg').situacao).toBe('abaixo');
      expect(linha(avaliarAdequacao({ ferroMg: 10 }, 60, 'female'), 'ferroMg').situacao).toBe('adequado');
    });

    it('zinco: 11 mg para homem, 8 mg para mulher', () => {
      expect(linha(avaliarAdequacao({ zincoMg: 9 }, 30, 'male'), 'zincoMg').situacao).toBe('abaixo');
      expect(linha(avaliarAdequacao({ zincoMg: 9 }, 30, 'female'), 'zincoMg').situacao).toBe('adequado');
    });
  });

  describe('RDA e AI são lidos de formas diferentes', () => {
    it('abaixo de uma RDA é "abaixo"', () => {
      expect(linha(avaliarAdequacao({ calcioMg: 500 }, 30, 'male'), 'calcioMg').situacao).toBe('abaixo');
    });

    it('abaixo de um AI é INDETERMINADO, não "abaixo"', () => {
      // O AI não foi construído para avaliar ingestão individual. Dizer
      // "inadequado" afirmaria o que a fonte não sustenta.
      const l = linha(avaliarAdequacao({ fibrasG: 10 }, 30, 'male'), 'fibrasG');
      expect(l.tipo).toBe('AI');
      expect(l.situacao).toBe('indeterminado');
      expect(l.leitura).toMatch(/não permite concluir/i);
    });

    it('acima de um AI também é indeterminado, com leitura mais tranquila', () => {
      const l = linha(avaliarAdequacao({ fibrasG: 45 }, 30, 'male'), 'fibrasG');
      expect(l.situacao).toBe('indeterminado');
      expect(l.leitura).toMatch(/baixa probabilidade/i);
    });
  });

  describe('limite superior', () => {
    it('acima do UL é risco, não "meta superada"', () => {
      const l = linha(avaliarAdequacao({ ferroMg: 60 }, 30, 'male'), 'ferroMg');
      expect(l.situacao).toBe('acima_ul');
      expect(l.leitura).toMatch(/limite superior/i);
    });

    it('o UL do cálcio cai de 2500 para 2000 depois dos 50', () => {
      expect(linha(avaliarAdequacao({ calcioMg: 2200 }, 40, 'male'), 'calcioMg').situacao).toBe('adequado');
      expect(linha(avaliarAdequacao({ calcioMg: 2200 }, 60, 'male'), 'calcioMg').situacao).toBe('acima_ul');
    });

    it('o UL do magnésio avisa que vale só para suplemento', () => {
      const l = linha(avaliarAdequacao({ magnesioMg: 400 }, 30, 'male'), 'magnesioMg');
      expect(l.situacao).toBe('acima_ul');
      expect(l.leitura).toMatch(/farmacológico/i);
    });
  });

  describe('sódio usa CDRR, não UL', () => {
    it('acima de 2.300 mg cai em acima_cdrr', () => {
      const l = linha(avaliarAdequacao({ sodioMg: 3000 }, 30, 'male'), 'sodioMg');
      expect(l.situacao).toBe('acima_cdrr');
      expect(l.leitura).toMatch(/2300|2\.300/);
    });

    it('o limiar é 2.300 mg e vale para todos os adultos', () => {
      expect(CDRR_SODIO.limiteMg).toBe(2300);
    });

    it('o AI de sódio é 1.500 mg para ambos os sexos', () => {
      const ref = referenciaDe('sodioMg')!;
      expect(ref.valores.male['19-30']).toBe(1500);
      expect(ref.valores.female['70+']).toBe(1500);
    });

    it('sódio NÃO tem UL desde 2019', () => {
      // Confundir o CDRR com o antigo UL de 2,3 g é fácil: o número coincide.
      expect(referenciaDe('sodioMg')!.ul).toBeNull();
    });
  });

  describe('potássio usa os valores de 2019', () => {
    it('3.400 mg para homem e 2.600 para mulher, não os 4.700 de 2005', () => {
      const ref = referenciaDe('potassioMg')!;
      expect(ref.valores.male['19-30']).toBe(3400);
      expect(ref.valores.female['19-30']).toBe(2600);
    });

    it('a fonte citada é a de 2019', () => {
      expect(referenciaDe('potassioMg')!.fonte).toMatch(/2019/);
    });
  });

  describe('nutriente sem dado na base', () => {
    it('chave ausente vira sem_dado, não zero', () => {
      // Zero afirmaria que a dieta não fornece. O que não existe é o dado.
      const l = linha(avaliarAdequacao({}, 30, 'male'), 'calcioMg');
      expect(l.situacao).toBe('sem_dado');
      expect(l.ofertado).toBeNull();
      expect(l.percentual).toBeNull();
    });

    it('valor zero é DIFERENTE de ausente', () => {
      const l = linha(avaliarAdequacao({ calcioMg: 0 }, 30, 'male'), 'calcioMg');
      expect(l.situacao).toBe('abaixo');
      expect(l.ofertado).toBe(0);
    });

    it('declara os nutrientes que a base não cobre', () => {
      const r = avaliarAdequacao({}, 30, 'male');
      expect(r.semDadoNaBase).toEqual(expect.arrayContaining(['Vitamina D', 'Vitamina B12', 'Folato']));
    });
  });

  describe('procedência', () => {
    it('toda linha carrega a fonte do valor', () => {
      for (const l of avaliarAdequacao({ calcioMg: 900 }, 30, 'male').linhas) {
        expect(l.fonte.length).toBeGreaterThan(10);
      }
    });
  });

  describe('resumo', () => {
    it('conta cada situação separadamente', () => {
      const r = avaliarAdequacao(
        { calcioMg: 500, ferroMg: 60, fibrasG: 10, zincoMg: 15 },
        30, 'male',
      );
      const s = resumir(r.linhas);
      expect(s.abaixo).toBeGreaterThanOrEqual(1);
      expect(s.acimaDoLimite).toBeGreaterThanOrEqual(1);
      expect(s.indeterminados).toBeGreaterThanOrEqual(1);
      expect(s.semDado).toBeGreaterThanOrEqual(1);
    });
  });
});
