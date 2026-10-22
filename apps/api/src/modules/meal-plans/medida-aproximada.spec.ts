import {
  aproximarEmMedida, descreverMedida, DESVIO_MAXIMO_PCT,
  type MedidaDisponivel,
} from './medida-aproximada';

/**
 * A lista de trocas vai para a mão do paciente, e "235,3 g de batata" exige
 * balança. Traduzir para "2 colheres de servir" é o que faz a troca
 * acontecer.
 *
 * O risco é o inverso do habitual: aqui o perigo não é recusar demais, é
 * ACEITAR demais — oferecer uma medida que não representa a quantidade
 * prescrita e apresentá-la como se representasse.
 */

const m = (medida: string, gramas: number, padrao = false): MedidaDisponivel =>
  ({ medida, gramas, padrao });

const ARROZ = [
  m('colher de sopa', 25),
  m('colher de arroz/servir', 45, true),
  m('concha', 100),
  m('prato fundo', 200),
];

describe('medida aproximada', () => {
  describe('o que deve encontrar', () => {
    it('acha a medida exata quando existe', () => {
      const r = aproximarEmMedida(90, ARROZ)!;
      expect(r.medida).toBe('colher de arroz/servir');
      expect(r.quantidade).toBe(2);
      expect(r.gramasReais).toBe(90);
      expect(r.desvioG).toBe(0);
    });

    it('aceita meia unidade, que é o menor passo da cozinha', () => {
      const r = aproximarEmMedida(50, ARROZ)!;
      // 50 g = 2 colheres de sopa (50) OU 1 colher de servir (45, −10%).
      // A de menos unidades só vence em EMPATE de desvio; aqui a de sopa
      // acerta na mosca.
      expect(r.gramasReais).toBe(50);
      expect(r.desvioG).toBe(0);
    });

    it('prefere menos unidades quando o desvio empata', () => {
      // 100 g: 1 concha (100) ou 4 colheres de sopa (100). Ambas exatas.
      const r = aproximarEmMedida(100, ARROZ)!;
      expect(r.medida).toBe('concha');
      expect(r.quantidade).toBe(1);
    });

    it('a mais próxima vence a de menos unidades', () => {
      // 95 g: 1 concha erra 5 (5,3%); 2 colheres de servir erram 5 (5,3%).
      // Empate real — vence a de menos unidades.
      const r = aproximarEmMedida(95, ARROZ)!;
      expect(r.quantidade).toBe(1);
      expect(r.medida).toBe('concha');
    });
  });

  describe('o que deve RECUSAR', () => {
    it('recusa quando nenhuma medida chega perto', () => {
      // 7 g: metade de uma colher de sopa são 12,5 g, 78% acima.
      expect(aproximarEmMedida(7, ARROZ)).toBeNull();
    });

    it('recusa acima do desvio máximo, em vez de forçar', () => {
      // Uma medida só, de 100 g, e alvo de 130: o mais perto é 1 unidade,
      // 23% abaixo. Apresentar "1 concha" para 130 g seria afirmar algo
      // falso sobre a prescrição.
      const r = aproximarEmMedida(130, [m('concha', 100)]);
      expect(r).toBeNull();
    });

    it('aceita exatamente no limite do desvio', () => {
      // 100 g de alvo contra uma medida de 110: 10% de desvio.
      const r = aproximarEmMedida(100, [m('unidade', 110)]);
      expect(r).not.toBeNull();
      expect(r!.desvioPct).toBeCloseTo(DESVIO_MAXIMO_PCT, 1);
    });

    it('sem medidas, sem aproximação', () => {
      expect(aproximarEmMedida(100, [])).toBeNull();
      expect(aproximarEmMedida(100, undefined as never)).toBeNull();
    });

    it('alvo inválido não vira medida', () => {
      for (const alvo of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(aproximarEmMedida(alvo, ARROZ)).toBeNull();
      }
    });

    it('medida com peso zero é ignorada, não divide por zero', () => {
      const r = aproximarEmMedida(100, [m('quebrada', 0), m('concha', 100)]);
      expect(r!.medida).toBe('concha');
    });
  });

  describe('o desvio fica declarado', () => {
    it('devolve o peso REAL da medida, não o alvo', () => {
      // Esta é a regra que impede a aproximação de virar mentira: a tela
      // mostra o que "2 colheres" realmente pesam, não o que se pediu.
      const r = aproximarEmMedida(96, ARROZ)!;
      expect(r.gramasReais).not.toBe(96);
      expect(r.gramasReais).toBe(r.quantidade * ARROZ.find((x) => x.medida === r.medida)!.gramas);
    });

    it('o desvio tem sinal: para mais e para menos', () => {
      // 104 g: a concha pesa 100, fica 4 g ABAIXO.
      const paraMenos = aproximarEmMedida(104, ARROZ)!;
      expect(paraMenos.gramasReais).toBe(100);
      expect(paraMenos.desvioG).toBeLessThan(0);

      // 96 g: a concha pesa 100, fica 4 g ACIMA — e vence as 2 colheres de
      // servir (90), que errariam 6. A mais proxima ganha, para qualquer lado.
      const paraMais = aproximarEmMedida(96, ARROZ)!;
      expect(paraMais.gramasReais).toBe(100);
      expect(paraMais.desvioG).toBeGreaterThan(0);
    });
  });

  describe('como se escreve', () => {
    it('pluraliza o substantivo, não o complemento', () => {
      // "colheres de sopa", nunca "colher de sopas".
      expect(descreverMedida({
        quantidade: 2, medida: 'colher de sopa',
        gramasReais: 50, desvioG: 0, desvioPct: 0,
      })).toBe('2 colheres de sopa');
    });

    it('singular quando é uma só', () => {
      expect(descreverMedida({
        quantidade: 1, medida: 'concha', gramasReais: 100, desvioG: 0, desvioPct: 0,
      })).toBe('1 concha');
    });

    it('meia unidade usa vírgula decimal', () => {
      expect(descreverMedida({
        quantidade: 1.5, medida: 'fatia', gramasReais: 45, desvioG: 0, desvioPct: 0,
      })).toBe('1,5 fatias');
    });

    it('não duplica o plural de medida que já termina em s', () => {
      expect(descreverMedida({
        quantidade: 3, medida: 'gomos', gramasReais: 60, desvioG: 0, desvioPct: 0,
      })).toBe('3 gomos');
    });

    it('flexiona o que da, e deixa em paz o que nao da', () => {
      const d = (medida: string) => descreverMedida({
        quantidade: 2, medida, gramasReais: 1, desvioG: 0, desvioPct: 0,
      });
      expect(d('colher')).toBe('2 colheres');
      // O plural de "-ão" nao e derivavel: pao/paes, limao/limoes,
      // irmao/irmaos. Fica no singular em vez de inventar.
      expect(d('pão')).toBe('2 pão');
      // A base nao tem medida terminada em "l": o que nao se sabe flexionar
      // fica no singular, que e feio e honesto em vez de inventado.
      expect(d('pastel')).toBe('2 pastel');
      expect(d('garfada')).toBe('2 garfadas');
    });

    it('o adjetivo concorda, a locucao nao', () => {
      // "copo medio" -> "copos medios" (medio e adjetivo).
      // "colher de sopa" -> "colheres de sopa" (de sopa e locucao).
      // A preposicao e o que separa os dois casos, e ambos existem na base.
      const d = (medida: string) => descreverMedida({
        quantidade: 2, medida, gramasReais: 1, desvioG: 0, desvioPct: 0,
      });
      expect(d('copo medio')).toBe('2 copos medios');
      expect(d('prato fundo')).toBe('2 pratos fundos');
      expect(d('unidade pequena')).toBe('2 unidades pequenas');
      expect(d('copo grande')).toBe('2 copos grandes');
      expect(d('colher de sopa')).toBe('2 colheres de sopa');
      expect(d('copo de requeijao')).toBe('2 copos de requeijao');
      expect(d('colher de arroz/servir')).toBe('2 colheres de arroz/servir');
      // Parentetico nao se mexe.
      expect(d('lata (n. e.)')).toBe('2 lata (n. e.)');
    });
  });
});
