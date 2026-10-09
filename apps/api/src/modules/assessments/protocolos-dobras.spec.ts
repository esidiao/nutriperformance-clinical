import {
  PROTOCOLOS, protocoloPorId, siri, composicao, classificarGordura, PENDENTES,
  type Sitio,
} from '../../../../web/lib/protocolos-dobras';

/**
 * O módulo mora em `apps/web/lib` porque a tela calcula enquanto a
 * profissional digita; o teste mora aqui porque é onde existe runner. Specs
 * são excluídas do build da API (`tsconfig.build.json`), então o import
 * atravessando pacotes não entra no bundle.
 *
 * Uma constante errada aqui não gera erro: gera um percentual de gordura
 * plausível, que entra no prontuário e vira conduta. Por isso os testes
 * conferem VALOR, não só "não quebrou".
 */
describe('protocolos de dobras cutâneas', () => {
  describe('conversão de densidade', () => {
    it('Siri: densidade 1.05 dá ~21,4%', () => {
      expect(Math.round(siri(1.05) * 10) / 10).toBe(21.4);
    });

    it('densidade maior significa menos gordura', () => {
      expect(siri(1.08)).toBeLessThan(siri(1.03));
    });
  });

  describe('Jackson & Pollock 3 dobras', () => {
    const jp3 = protocoloPorId('jackson_pollock_3')!;

    it('usa sítios DIFERENTES para homem e mulher', () => {
      // Era o defeito da tela antiga: pedia os sítios femininos para todos.
      expect(jp3.sitios('male')).toEqual(['chest', 'abdominal', 'thigh']);
      expect(jp3.sitios('female')).toEqual(['triceps', 'suprailiac', 'thigh']);
    });

    it('homem 30 anos, Σ 45 mm (15+20+10)', () => {
      const r = jp3.calcular({ chest: 15, abdominal: 20, thigh: 10 }, 30, 'male');
      // D = 1.10938 − 0.0008267(45) + 0.0000016(2025) − 0.0002574(30) = 1.067…
      expect(r).toBeGreaterThan(13);
      expect(r).toBeLessThan(16);
    });

    it('mulher 30 anos, Σ 60 mm (20+25+15)', () => {
      const r = jp3.calcular({ triceps: 20, suprailiac: 25, thigh: 15 }, 30, 'female');
      expect(r).toBeGreaterThan(22);
      expect(r).toBeLessThan(27);
    });

    it('mesmas medidas dão resultados DIFERENTES por sexo', () => {
      // Prova que a equação troca de verdade — o bug antigo passava
      // despercebido justamente porque o resultado nunca mudava.
      const medidas = { chest: 15, abdominal: 20, thigh: 10, triceps: 15, suprailiac: 20 };
      const h = jp3.calcular(medidas, 30, 'male');
      const m = jp3.calcular(medidas, 30, 'female');
      expect(h).not.toEqual(m);
    });

    it('a idade muda o resultado', () => {
      const medidas = { chest: 15, abdominal: 20, thigh: 10 };
      expect(jp3.calcular(medidas, 20, 'male')).not.toEqual(jp3.calcular(medidas, 50, 'male'));
    });

    it('sem idade não calcula', () => {
      expect(jp3.calcular({ chest: 15, abdominal: 20, thigh: 10 }, 0, 'male')).toBeNull();
    });

    it('faltando uma dobra, devolve null em vez de somar o que tem', () => {
      // Somar 2 de 3 daria um número menor e plausível — pior que não ter.
      expect(jp3.calcular({ chest: 15, abdominal: 20 }, 30, 'male')).toBeNull();
    });
  });

  describe('Jackson & Pollock 7 dobras', () => {
    const jp7 = protocoloPorId('jackson_pollock_7')!;

    it('pede os 7 sítios, iguais para ambos os sexos', () => {
      const esperado: Sitio[] = [
        'chest', 'midaxillary', 'triceps', 'subscapular', 'abdominal', 'suprailiac', 'thigh',
      ];
      expect(jp7.sitios('male')).toEqual(esperado);
      expect(jp7.sitios('female')).toEqual(esperado);
    });

    it('inclui a axilar média — o sítio que faltava no cadastro', () => {
      expect(jp7.sitios('male')).toContain('midaxillary');
    });

    it('homem 30 anos, Σ 100 mm', () => {
      const m = { chest: 10, midaxillary: 12, triceps: 14, subscapular: 16, abdominal: 20, suprailiac: 18, thigh: 10 };
      const r = jp7.calcular(m, 30, 'male');
      expect(r).toBeGreaterThan(14);
      expect(r).toBeLessThan(20);
    });

    it('resultado difere entre sexos com as mesmas medidas', () => {
      const m = { chest: 10, midaxillary: 12, triceps: 14, subscapular: 16, abdominal: 20, suprailiac: 18, thigh: 10 };
      expect(jp7.calcular(m, 30, 'male')).not.toEqual(jp7.calcular(m, 30, 'female'));
    });

    it('faltando a axilar média, não calcula', () => {
      const m = { chest: 10, triceps: 14, subscapular: 16, abdominal: 20, suprailiac: 18, thigh: 10 };
      expect(jp7.calcular(m, 30, 'male')).toBeNull();
    });
  });

  describe('Faulkner 4 dobras', () => {
    const f = protocoloPorId('faulkner_4')!;

    it('Σ 100 mm dá 21,1%', () => {
      // 100 × 0,153 + 5,783 = 21,083 → 21,1
      expect(f.calcular({ triceps: 25, subscapular: 25, suprailiac: 25, abdominal: 25 }, 30, 'male')).toBe(21.1);
    });

    it('NÃO usa idade — mesma soma, mesmo resultado', () => {
      const m = { triceps: 25, subscapular: 25, suprailiac: 25, abdominal: 25 };
      expect(f.calcular(m, 20, 'male')).toBe(f.calcular(m, 60, 'male'));
    });

    it('NÃO distingue sexo — é a característica da equação', () => {
      const m = { triceps: 25, subscapular: 25, suprailiac: 25, abdominal: 25 };
      expect(f.calcular(m, 30, 'male')).toBe(f.calcular(m, 30, 'female'));
    });
  });

  describe('composição corporal', () => {
    it('80 kg com 20% dá 16 kg de gordura e 64 de massa magra', () => {
      expect(composicao(20, 80)).toEqual({ massaGordaKg: 16, massaMagraKg: 64 });
    });

    it('sem percentual ou sem peso, devolve null — não zero', () => {
      expect(composicao(null, 80)).toEqual({ massaGordaKg: null, massaMagraKg: null });
      expect(composicao(20, null)).toEqual({ massaGordaKg: null, massaMagraKg: null });
    });
  });

  describe('classificação ACSM', () => {
    it('as faixas diferem por sexo', () => {
      // 22% é "Aceitável" para homem e "Bom" para mulher. Classificar sem
      // saber o sexo trocaria a leitura clínica.
      expect(classificarGordura(22, 'male').label).toBe('Aceitável');
      expect(classificarGordura(22, 'female').label).toBe('Bom');
    });
  });

  describe('honestidade sobre o que falta', () => {
    it('declara os protocolos pedidos e não implementados, com o motivo', () => {
      const nomes = PENDENTES.map((p) => p.nome).join(' ');
      expect(nomes).toMatch(/Petroski/);
      expect(nomes).toMatch(/Guedes/);
      expect(nomes).toMatch(/Durnin/);
      for (const p of PENDENTES) expect(p.motivo.length).toBeGreaterThan(20);
    });

    it('só expõe protocolos que calculam de verdade', () => {
      for (const p of PROTOCOLOS) {
        const medidas: Partial<Record<Sitio, number>> = {};
        for (const s of p.sitios('male')) medidas[s] = 15;
        const r = p.calcular(medidas, 30, 'male');
        expect(typeof r).toBe('number');
        expect(r).toBeGreaterThan(0);
      }
    });
  });
});
