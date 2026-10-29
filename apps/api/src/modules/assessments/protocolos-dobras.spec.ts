import {
  PROTOCOLOS, protocoloPorId, protocolosPara, siri, composicao,
  classificarGordura, PENDENTES, type Sitio, foraDaFaixa,
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

  describe('Durnin & Womersley 4 dobras', () => {
    const dw = protocoloPorId('durnin_womersley_4')!;

    it('exige bíceps, tríceps, subescapular e supra-ilíaca', () => {
      expect(dw.sitios('male')).toEqual(['biceps', 'triceps', 'subscapular', 'suprailiac']);
    });

    it('as constantes mudam por FAIXA ETÁRIA, não continuamente', () => {
      // 25 e 28 caem na mesma faixa (20–29): mesmo Σ, mesmo resultado.
      const m = { biceps: 8, triceps: 12, subscapular: 14, suprailiac: 16 };
      expect(dw.calcular(m, 25, 'male')).toBe(dw.calcular(m, 28, 'male'));
      // 29 e 31 caem em faixas diferentes: o resultado muda.
      expect(dw.calcular(m, 29, 'male')).not.toBe(dw.calcular(m, 31, 'male'));
    });

    it('resultado difere entre sexos', () => {
      const m = { biceps: 8, triceps: 12, subscapular: 14, suprailiac: 16 };
      expect(dw.calcular(m, 30, 'male')).not.toEqual(dw.calcular(m, 30, 'female'));
    });

    it('homem 25 anos, Σ 50 mm fica em faixa plausível', () => {
      const r = dw.calcular({ biceps: 8, triceps: 12, subscapular: 14, suprailiac: 16 }, 25, 'male');
      expect(r).toBeGreaterThan(10);
      expect(r).toBeLessThan(25);
    });

    it('idade acima de 50 usa a última faixa, sem quebrar', () => {
      const m = { biceps: 8, triceps: 12, subscapular: 14, suprailiac: 16 };
      expect(typeof dw.calcular(m, 75, 'female')).toBe('number');
    });

    it('faltando o bíceps, não calcula', () => {
      expect(dw.calcular({ triceps: 12, subscapular: 14, suprailiac: 16 }, 30, 'male')).toBeNull();
    });

    it('saiu da lista de pendentes', () => {
      expect(PENDENTES.map((p) => p.nome).join(' ')).not.toMatch(/Durnin/);
    });
  });

  describe('constantes visíveis para conferência', () => {
    it('todo protocolo declara as constantes que usa', () => {
      // Coeficiente errado devolve percentual plausível. Deixar a conta
      // visível é o que permite conferir contra o livro.
      for (const p of PROTOCOLOS) {
        expect(p.constantes.length).toBeGreaterThan(0);
        expect(p.constantes.join(' ')).toMatch(/\d/);
      }
    });

    it('Durnin lista a tabela por faixa etária', () => {
      const texto = protocoloPorId('durnin_womersley_4')!.constantes.join('\n');
      expect(texto).toMatch(/17–19|17-19/);
      expect(texto).toMatch(/50\+/);
    });
  });

  describe('Guedes 3 dobras (feminina)', () => {
    const g = protocoloPorId('guedes_3')!;

    it('usa coxa, supra-ilíaca e subescapular', () => {
      expect(g.sitios('female')).toEqual(['thigh', 'suprailiac', 'subscapular']);
    });

    it('é logarítmica: dobrar o somatório não dobra o efeito', () => {
      const a = g.calcular({ thigh: 10, suprailiac: 10, subscapular: 10 }, 30, 'female');
      const b = g.calcular({ thigh: 20, suprailiac: 20, subscapular: 20 }, 30, 'female');
      expect(b).toBeGreaterThan(a!);
      expect(b! - a!).toBeLessThan(a!); // crescimento desacelera
    });

    it('NÃO calcula para homem — só a versão feminina foi verificada', () => {
      // Aplicar a feminina a homem usaria a equação fora da população em que
      // foi validada: produz número, não medida.
      expect(g.calcular({ thigh: 15, suprailiac: 15, subscapular: 15 }, 30, 'male')).toBeNull();
    });

    it('não usa idade', () => {
      const m = { thigh: 15, suprailiac: 15, subscapular: 15 };
      expect(g.calcular(m, 20, 'female')).toBe(g.calcular(m, 60, 'female'));
    });
  });

  describe('Petroski (feminina)', () => {
    const p5 = protocoloPorId('petroski_5')!;
    const p4 = protocoloPorId('petroski_4')!;
    const p3 = protocoloPorId('petroski_3')!;
    const antro = { pesoKg: 60, estaturaCm: 165 };

    it('os sítios batem com a Tabela 2 da fonte', () => {
      expect(p5.sitios('female')).toEqual(['subscapular', 'triceps', 'suprailiac', 'abdominal', 'calf']);
      expect(p4.sitios('female')).toEqual(['subscapular', 'triceps', 'suprailiac', 'calf']);
      expect(p3.sitios('female')).toEqual(['subscapular', 'suprailiac', 'thigh']);
    });

    it('todas exigem peso e estatura', () => {
      for (const p of [p3, p4, p5]) expect(p.exigeAntropometria).toBe(true);
    });

    it('sem peso ou sem estatura, não calcula', () => {
      const m = { subscapular: 15, triceps: 15, suprailiac: 15, abdominal: 15, calf: 15 };
      expect(p5.calcular(m, 30, 'female', { pesoKg: 60 })).toBeNull();
      expect(p5.calcular(m, 30, 'female', { estaturaCm: 165 })).toBeNull();
      expect(p5.calcular(m, 30, 'female')).toBeNull();
    });

    it('5 dobras devolve percentual plausível', () => {
      const m = { subscapular: 18, triceps: 20, suprailiac: 16, abdominal: 22, calf: 14 };
      const r = p5.calcular(m, 30, 'female', antro);
      expect(r).toBeGreaterThan(10);
      expect(r).toBeLessThan(45);
    });

    it('o termo LINEAR existe — a versão sem ele é corrompida', () => {
      // Circula uma transcrição da equação de 4 dobras só com o termo
      // quadrático. Com Σ = 60 ela dá densidade NEGATIVA. Este teste prova
      // que a nossa não tem esse defeito.
      const m = { subscapular: 15, triceps: 15, suprailiac: 15, calf: 15 };
      const r = p4.calcular(m, 30, 'female', antro);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(60);
    });

    it('somatório maior dá mais gordura', () => {
      const magra = { subscapular: 8, triceps: 10, suprailiac: 8, abdominal: 10, calf: 8 };
      const gorda = { subscapular: 25, triceps: 30, suprailiac: 28, abdominal: 35, calf: 20 };
      expect(p5.calcular(gorda, 30, 'female', antro)!)
        .toBeGreaterThan(p5.calcular(magra, 30, 'female', antro)!);
    });

    it('NÃO calculam para homem', () => {
      const m = { subscapular: 15, triceps: 15, suprailiac: 15, abdominal: 15, calf: 15, thigh: 15 };
      for (const p of [p3, p4, p5]) {
        expect(p.calcular(m, 30, 'male', antro)).toBeNull();
      }
    });
  });

  describe('filtro por sexo', () => {
    it('homem não vê as equações FEMININAS de Petroski e Guedes', () => {
      const ids = protocolosPara('male').map((p) => p.id);
      expect(ids).not.toContain('guedes_3');
      expect(ids).not.toContain('petroski_5');
      expect(ids).toContain('jackson_pollock_3');
      // A masculina de Petroski entrou em 29/10/2026 e ele passa a vê-la.
      expect(ids).toContain('petroski_4_masculino');
    });

    it('mulher vê tudo que não é exclusivo de homem', () => {
      // Era "mulher vê todos", e passava só porque toda equação restrita no
      // catálogo era feminina — acidente do acervo, não regra. Com a Petroski
      // masculina o teste caiu, e a correção é dizer a regra de verdade: cada
      // um vê o que não é exclusivo do outro sexo.
      const ids = protocolosPara('female').map((p) => p.id);
      const soParaHomem = PROTOCOLOS.filter(
        (p) => p.aplicaA?.length === 1 && p.aplicaA[0] === 'male',
      );
      expect(ids).toHaveLength(PROTOCOLOS.length - soParaHomem.length);
      for (const p of soParaHomem) expect(ids).not.toContain(p.id);
      expect(ids).toContain('petroski_5');
    });

    it('sem sexo definido, só os que servem a ambos', () => {
      const ids = protocolosPara(null).map((p) => p.id);
      expect(ids).not.toContain('petroski_5');
      expect(ids).not.toContain('petroski_4_masculino');
      expect(ids).toContain('faulkner_4');
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
      // Durnin & Womersley saiu daqui em 10/10/2026: foi implementado.
      for (const p of PENDENTES) expect(p.motivo.length).toBeGreaterThan(20);
    });

    it('só expõe protocolos que calculam de verdade', () => {
      for (const p of PROTOCOLOS) {
        // Respeita o sexo para o qual a equação foi publicada.
        const sexo = p.aplicaA ? p.aplicaA[0] : 'male';
        const medidas: Partial<Record<Sitio, number>> = {};
        for (const s of p.sitios(sexo)) medidas[s] = 15;
        const r = p.calcular(medidas, 30, sexo, { pesoKg: 65, estaturaCm: 165 });
        expect(typeof r).toBe('number');
        expect(r).toBeGreaterThan(0);
        expect(r).toBeLessThan(70);
      }
    });
  });

  describe('faixa etaria de validacao', () => {
    // As faixas vem da apostila de antropometria que a profissional usa,
    // que as declara protocolo a protocolo. Aplicar uma equacao fora da
    // amostra em que foi construida produz um numero que PARECE medida.

    it('avisa fora da faixa, e nao avisa dentro', () => {
      const petroski = protocoloPorId('petroski_4')!;
      expect(foraDaFaixa(petroski, 30, 'female')).toBeNull();
      expect(foraDaFaixa(petroski, 60, 'female')).toMatch(/18 a 51/);
      expect(foraDaFaixa(petroski, 15, 'female')).toMatch(/extrapola/i);
    });

    it('AVISA, mas nao bloqueia: a decisao e clinica', () => {
      // O calculo continua saindo. Travar impediria a profissional de
      // avaliar uma paciente de 55 anos com Petroski, decisao que e dela.
      const petroski = protocoloPorId('petroski_4')!;
      const r = petroski.calcular(
        { subscapular: 15, triceps: 20, suprailiac: 18, calf: 14 },
        60, 'female', { pesoKg: 65, estaturaCm: 162 },
      );
      expect(r).not.toBeNull();
      expect(foraDaFaixa(petroski, 60, 'female')).not.toBeNull();
    });

    it('a faixa muda por sexo quando a fonte distingue', () => {
      // Jackson & Pollock: homens ate 61, mulheres ate 55.
      const jp = protocoloPorId('jackson_pollock_3')!;
      expect(foraDaFaixa(jp, 58, 'male')).toBeNull();
      expect(foraDaFaixa(jp, 58, 'female')).toMatch(/18 a 55/);
    });

    it('Guedes tem a faixa mais estreita: universitarios de 17 a 27', () => {
      const g = protocoloPorId('guedes_3')!;
      expect(foraDaFaixa(g, 22, 'female')).toBeNull();
      expect(foraDaFaixa(g, 40, 'female')).toMatch(/17 a 27/);
    });

    it('protocolo sem faixa declarada nao inventa aviso', () => {
      const d = protocoloPorId('durnin_womersley_4')!;
      expect(foraDaFaixa(d, 70, 'female')).toBeNull();
    });

    it('idade invalida nao vira aviso', () => {
      const p = protocoloPorId('petroski_4')!;
      for (const idade of [0, -1, Number.NaN]) {
        expect(foraDaFaixa(p, idade, 'female')).toBeNull();
      }
    });
  });
});

describe('Petroski masculina (4 dobras)', () => {
  const p = protocoloPorId('petroski_4_masculino')!;

  it('existe e serve só a homens', () => {
    expect(p).toBeDefined();
    expect(p.aplicaA).toEqual(['male']);
    expect(p.calcular({ subscapular: 12, triceps: 10, suprailiac: 14, calf: 9 }, 30, 'female'))
      .toBeNull();
  });

  it('usa as quatro dobras do X1 original', () => {
    expect(p.sitios('male')).toEqual(['subscapular', 'triceps', 'suprailiac', 'calf']);
  });

  it('NAO exige peso nem estatura', () => {
    // As femininas exigem; esta nao. A diferenca e do original, nao descuido.
    expect(p.exigeAntropometria).toBeFalsy();
    expect(p.calcular({ subscapular: 12, triceps: 10, suprailiac: 14, calf: 9 }, 30, 'male'))
      .not.toBeNull();
  });

  it('o termo quadratico esta mesmo ao quadrado', () => {
    // A guarda do defeito que a nutricionista apontou: o slide dela trazia
    // `+ 0,00000212 (sigma)` sem o expoente. Com sigma = 45 e idade 30:
    //   D = 1,10726863 - 0,00081201*45 + 0,00000212*2025 - 0,00041761*30
    //     = 1,10726863 - 0,03654045 + 0,0042930 - 0,0125283 = 1,06248
    //   %G = 495/1,06248 - 450 = 15,93...
    // Sem o quadrado o terceiro termo seria 0,0000954 e o %G daria ~17,2:
    // plausivel, e errado. E por isso que este teste existe.
    const pct = p.calcular(
      { subscapular: 10, triceps: 12, suprailiac: 15, calf: 8 }, 30, 'male',
    );
    expect(pct).toBeCloseTo(15.9, 1);
  });

  it('avisa fora da faixa de validacao, sem bloquear', () => {
    expect(foraDaFaixa(p, 70, 'male')).toMatch(/18 a 61/);
    expect(foraDaFaixa(p, 30, 'male')).toBeNull();
  });
});
