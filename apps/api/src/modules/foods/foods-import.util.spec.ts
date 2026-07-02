import { parseNum, pick, mapRow, validateFood } from './foods-import.util';

describe('foods-import.util', () => {
  describe('parseNum', () => {
    it('converte vírgula decimal e trata sentinelas TACO', () => {
      expect(parseNum('12,5')).toBe(12.5);
      expect(parseNum('100')).toBe(100);
      expect(parseNum('Tr')).toBeNull();
      expect(parseNum('NA')).toBeNull();
      expect(parseNum('*')).toBeNull();
      expect(parseNum('')).toBeNull();
      expect(parseNum(undefined)).toBeNull();
    });
  });

  describe('pick', () => {
    it('encontra coluna por nome alternativo e case-insensitive', () => {
      const row = { 'Proteína': '20', kcal: '120' };
      expect(pick(row, ['proteina', 'protein'])).toBe('20');
      expect(pick(row, ['energia_kcal', 'kcal'])).toBe('120');
      expect(pick(row, ['inexistente'])).toBeUndefined();
    });
  });

  const opts = { fonte: 'taco', fonteVersao: '4ed', licenca: 'uso livre c/ atribuição', confiabilidade: 'alta' as const };

  describe('mapRow', () => {
    it('mapeia uma linha TACO para o formato foods', () => {
      const row = { nome: 'Arroz, integral, cozido', grupo: 'Cereais', kcal: '124', carboidrato: '25,8', proteina: '2,6', gordura: '1,0', ferro: '0,3' };
      const f = mapRow(row, opts);
      expect(f.nome_padronizado).toBe('Arroz, integral, cozido');
      expect(f.energia_kcal).toBe(124);
      expect(f.carboidratos_g).toBe(25.8);
      expect(f.proteinas_g).toBe(2.6);
      expect(f.ferro_mg).toBe(0.3);
      expect(f.fonte).toBe('taco');
      expect(f.confiabilidade).toBe('alta');
    });
  });

  describe('validateFood', () => {
    it('aceita alimento com kcal coerente (Atwater)', () => {
      const f = mapRow({ nome: 'X', kcal: '124', carboidrato: '25,8', proteina: '2,6', gordura: '1,0' }, opts);
      expect(validateFood(f).ok).toBe(true);
    });

    it('rejeita kcal incoerente (>30% de desvio) no modo estrito (default)', () => {
      const f = mapRow({ nome: 'X', kcal: '500', carboidrato: '10', proteina: '5', gordura: '1' }, opts);
      const r = validateFood(f);
      expect(r.ok).toBe(false);
      expect(r.errors.some((e) => e.includes('kcal incoerente'))).toBe(true);
    });

    it('kcal incoerente vira AVISO (não rejeita) para fonte autoritativa (strictKcal:false)', () => {
      const f = mapRow({ nome: 'X', kcal: '500', carboidrato: '10', proteina: '5', gordura: '1' }, opts);
      const r = validateFood(f, { strictKcal: false });
      expect(r.ok).toBe(true);
      expect(r.warnings.some((w) => w.includes('kcal incoerente'))).toBe(true);
    });

    it('mapeia cabeçalhos reais da TACO (acentos/pontos)', () => {
      const row: Record<string, string> = {
        'Número do Alimento': '1', 'Categoria do alimento': 'Cereais e derivados',
        'Descrição dos alimentos': 'Arroz, integral, cozido', 'Energia..kcal.': '124',
        'Proteína..g.': '2.6', 'Carboidrato..g.': '25.8', 'Lipídeos..g.': '1',
        'Fibra.Alimentar..g.': '2.7', 'Sódio..mg.': '1', 'Ferro..mg.': '0.3', 'Zinco..mg.': '0.7',
      };
      const f = mapRow(row, opts);
      expect(f.nome_padronizado).toBe('Arroz, integral, cozido');
      expect(f.grupo_alimentar).toBe('Cereais e derivados');
      expect(f.energia_kcal).toBe(124);
      expect(f.fibras_g).toBe(2.7);
      expect(f.zinco_mg).toBe(0.7);
      expect(f.fonte_id_externo).toBe('1');
    });

    it('rejeita linha sem nome', () => {
      const f = mapRow({ kcal: '100' }, opts);
      expect(validateFood(f).ok).toBe(false);
    });

    it('rejeita valores negativos', () => {
      const f = mapRow({ nome: 'X', proteina: '-5' }, opts);
      expect(validateFood(f).ok).toBe(false);
    });
  });
});
