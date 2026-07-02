import { normalize, toVectorLiteral, buildFoodChunkText, buildInteractionChunkText, buildProductChunkText } from './rag-chunk.util';

describe('rag-chunk.util', () => {
  describe('normalize', () => {
    it('retorna vetor unitário', () => {
      const v = normalize([3, 4]);
      const norm = Math.sqrt(v[0] ** 2 + v[1] ** 2);
      expect(norm).toBeCloseTo(1, 6);
      expect(v[0]).toBeCloseTo(0.6, 6);
    });
    it('trata vetor zero sem dividir por zero', () => {
      expect(normalize([0, 0])).toEqual([0, 0]);
    });
  });

  describe('toVectorLiteral', () => {
    it('formata para o pgvector', () => {
      expect(toVectorLiteral([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
    });
  });

  describe('buildFoodChunkText', () => {
    it('inclui nome, números presentes e a fonte', () => {
      const t = buildFoodChunkText({
        nomePadronizado: 'Feijão carioca cozido', grupoAlimentar: 'Leguminosas',
        porcaoPadraoG: 100, energiaKcal: 76, proteinasG: 4.8, ferroMg: 1.3, fonte: 'taco',
      });
      expect(t).toContain('Feijão carioca cozido');
      expect(t).toContain('grupo: Leguminosas');
      expect(t).toContain('proteína 4.8 g');
      expect(t).toContain('ferro 1.3 mg');
      expect(t).toContain('Fonte: TACO');
    });
    it('omite nutrientes ausentes', () => {
      const t = buildFoodChunkText({ nomePadronizado: 'X', fonte: 'taco', energiaKcal: 100 });
      expect(t).toContain('energia 100 kcal');
      expect(t).not.toContain('ferro');
    });
  });

  describe('buildInteractionChunkText', () => {
    it('descreve par, risco, mecanismo e recomendação', () => {
      const t = buildInteractionChunkText({
        entityA: 'vitamina k', entityB: 'varfarina', riskLevel: 'high',
        mechanism: 'antagoniza anticoagulante', recommendation: 'monitorar INR',
        evidenceQuality: 'meta-analysis', confidenceLevel: 'high',
      });
      expect(t).toContain('vitamina k × varfarina');
      expect(t).toContain('Risco: high');
      expect(t).toContain('monitorar INR');
    });
  });

  describe('buildProductChunkText', () => {
    it('descreve produto com Nutri-Score, NOVA, macros e alertas', () => {
      const t = buildProductChunkText({
        nomeComercial: 'Biscoito', marca: 'X', nutriScore: 'E', novaClassificacao: 4,
        tabelaNutricional: { energia_kcal: 480, sodio_mg: 650 }, alertaNutricional: ['Alto em sódio'],
      });
      expect(t).toContain('Biscoito');
      expect(t).toContain('Nutri-Score E');
      expect(t).toContain('sódio 650 mg');
      expect(t).toContain('Alto em sódio');
    });
  });
});
