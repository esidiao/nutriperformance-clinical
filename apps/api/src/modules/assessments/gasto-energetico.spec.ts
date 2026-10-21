import {
  FORMULAS, formulaPorId, calcular, faixaSchofield, ganhoPesoGDia,
  fatoresDe, fatorPorId, ESCALAS, PENDENTES, crescimentoEer,
  KCAL_POR_GRAMA_DE_CRESCIMENTO, REDUCAO_1_A_2_ANOS, IDADE_MINIMA_AJUSTE_INFANTIL,
  DEPOSITO_GESTACIONAL, DEPOSITO_OBESIDADE_DIVERGENTE, FAIXA_TABULADA_HB_1918,
  type Formula, type Sexo,
} from '../../../../web/lib/gasto-energetico';

/**
 * O QUE ESTES TESTES PROVAM, E O QUE NÃO PROVAM
 *
 * Coeficiente errado numa equação de gasto energético não dá erro: devolve
 * uma caloria plausível que vira prescrição. Teste que recalcula a equação
 * com os mesmos coeficientes do código não prova nada — só repete a conta.
 *
 * Então os testes das fórmulas FAO comparam contra as TABELAS PUBLICADAS no
 * mesmo relatório de onde os coeficientes vieram. A FAO publica, no capítulo
 * 4, os requerimentos já calculados por idade e peso (Tabelas 4.2 e 4.3).
 * Rodar a equação e cair no valor da tabela é evidência independente; não
 * cair é defeito. Foi exatamente assim que apareceu a redução de 7% da faixa
 * de 1 a 2 anos, que eu não tinha implementado.
 *
 * Para Mifflin, Harris-Benedict, Katch-McArdle e Cunningham NÃO existe essa
 * contraprova: eu não li a publicação original. Os testes delas verificam
 * estrutura e comportamento (sexo, campos exigidos, arredondamento), e o
 * teste de `verificacao` garante que a tela continue dizendo que são
 * pendentes de confirmação. Nenhum deles valida o coeficiente.
 */

const E = (over: Partial<Parameters<typeof calcular>[1]> = {}) => ({
  pesoKg: 70, alturaCm: 170, idade: 30, sexo: 'male' as Sexo, ...over,
});

const f = (id: string): Formula => {
  const achada = formulaPorId(id);
  if (!achada) throw new Error(`fórmula ${id} não existe`);
  return achada;
};

describe('gasto energético', () => {
  // ─── FAO/WHO/UNU 2004, adulto: Tabela 5.2 ────────────────────────────────

  describe('FAO 2004 — Schofield (Tabela 5.2)', () => {
    it('escolhe a faixa com topo EXCLUSIVO: 30 anos cai em 30-60', () => {
      // O limite importa: nos homens, 18-30 e 30-60 diferem em ~180 kcal
      // para 70 kg. Arredondar a faixa mudaria a prescrição.
      expect(faixaSchofield('male', 29)!.a).toBeCloseTo(15.057, 3);
      expect(faixaSchofield('male', 30)!.a).toBeCloseTo(11.472, 3);
      expect(faixaSchofield('male', 59)!.a).toBeCloseTo(11.472, 3);
      expect(faixaSchofield('male', 60)!.a).toBeCloseTo(11.711, 3);
    });

    it('cobre as seis faixas dos dois sexos, sem buraco', () => {
      for (const sexo of ['male', 'female'] as Sexo[]) {
        for (const idade of [1, 2, 5, 9, 12, 17, 18, 25, 30, 45, 59, 60, 80, 99]) {
          expect(faixaSchofield(sexo, idade)).not.toBeNull();
        }
      }
    });

    it('homem de 70 kg e 25 anos: 15,057×70 + 692,2', () => {
      const r = calcular(f('fao_who_unu_2004'), E({ idade: 25 }), null);
      expect(r.tmb).toBe(Math.round(15.057 * 70 + 692.2));
      // Sem fator escolhido, há TMB e não há GET — e a tela diz o que falta.
      expect(r.get).toBeNull();
      expect(r.faltando).toEqual(['o fator de atividade']);
    });

    it('mulher de 60 kg e 40 anos usa 8,126 e 845,6, não a faixa masculina', () => {
      const r = calcular(
        f('fao_who_unu_2004'),
        E({ sexo: 'female', pesoKg: 60, idade: 40 }),
        null,
      );
      expect(r.tmb).toBe(Math.round(8.126 * 60 + 845.6));
    });

    it('aplica o fator da escala FAO sobre a TMB', () => {
      const r = calcular(f('fao_who_unu_2004'), E({ idade: 25 }), 1.85);
      expect(r.get).toBe(Math.round((15.057 * 70 + 692.2) * 1.85));
    });

    it('oferece a escala PAL da FAO, não a de 1,2 a 1,9', () => {
      const valores = fatoresDe(f('fao_who_unu_2004'), 30).map((x) => x.valor);
      expect(valores.every((v) => v >= 1.4 && v <= 2.4)).toBe(true);
      expect(valores).not.toContain(1.2);
    });
  });

  // ─── FAO/WHO/UNU 2004, criança: contraprova pelas Tabelas 4.2 e 4.3 ──────

  describe('FAO 2004 — criança, contra as Tabelas 4.2 e 4.3 publicadas', () => {
    /**
     * Peso médio e requerimento em kcal/dia, como o relatório publica.
     * `idade` é um ponto dentro da faixa que a linha descreve.
     */
    const TABELA_4_2_MENINOS: Array<[idade: number, pesoKg: number, reqKcal: number]> = [
      [1.5, 11.5, 948], [2.5, 13.5, 1129], [3.5, 15.7, 1252], [4.5, 17.7, 1360],
      [5.5, 19.7, 1467], [6.5, 21.7, 1573], [7.5, 24.0, 1692], [8.5, 26.7, 1830],
      [9.5, 29.7, 1978], [10.5, 33.3, 2150], [11.5, 37.5, 2341], [12.5, 42.3, 2548],
      [13.5, 47.8, 2770], [14.5, 53.8, 2990], [15.5, 59.5, 3178], [16.5, 64.4, 3322],
      [17.5, 67.8, 3410],
    ];

    const TABELA_4_3_MENINAS: Array<[idade: number, pesoKg: number, reqKcal: number]> = [
      [1.5, 10.8, 865], [2.5, 13.0, 1047], [3.5, 15.1, 1156], [4.5, 16.8, 1241],
      [5.5, 18.6, 1330], [6.5, 20.6, 1428], [7.5, 23.3, 1554], [8.5, 26.6, 1698],
      [9.5, 30.5, 1854], [10.5, 34.7, 2006], [11.5, 39.2, 2149], [12.5, 43.8, 2276],
      [13.5, 48.3, 2379], [14.5, 52.1, 2449], [15.5, 55.0, 2491], [16.5, 56.4, 2503],
      [17.5, 56.7, 2503],
    ];

    /**
     * Tolerância de 4 kcal.
     *
     * O relatório calcula em MJ e converte, então o valor em kcal da tabela
     * carrega o arredondamento do MJ. E "2 kcal/g" é o próprio relatório
     * arredondando 8,6 kJ/g (= 2,055 kcal/g). Daí a folga — que é de
     * arredondamento, não de coeficiente: um coeficiente trocado erra por
     * dezenas ou centenas de kcal, não por 4.
     */
    const FOLGA = 4;

    it.each(TABELA_4_2_MENINOS)(
      'menino de %s anos e %s kg → %s kcal (Tabela 4.2)',
      (idade, pesoKg, reqKcal) => {
        const r = calcular(f('fao_2004_crianca'), { pesoKg, idade, sexo: 'male' }, 1);
        expect(r.get).toBeGreaterThanOrEqual(reqKcal - FOLGA);
        expect(r.get).toBeLessThanOrEqual(reqKcal + FOLGA);
      },
    );

    it.each(TABELA_4_3_MENINAS)(
      'menina de %s anos e %s kg → %s kcal (Tabela 4.3)',
      (idade, pesoKg, reqKcal) => {
        const r = calcular(f('fao_2004_crianca'), { pesoKg, idade, sexo: 'female' }, 1);
        expect(r.get).toBeGreaterThanOrEqual(reqKcal - FOLGA);
        expect(r.get).toBeLessThanOrEqual(reqKcal + FOLGA);
      },
    );

    it('sem a redução de 7%, a faixa de 1 a 2 anos erraria para cima', () => {
      // Esta é a prova de que a redução existe e importa: o TEE cru de um
      // menino de 11,5 kg passa de 1000 kcal, e a Tabela 4.2 publica 948.
      const kg = 11.5;
      const teeCru = 310.2 + 63.3 * kg - 0.263 * kg * kg;
      expect(teeCru).toBeGreaterThan(1000);
      expect(Math.round(teeCru * REDUCAO_1_A_2_ANOS + 6.6 * KCAL_POR_GRAMA_DE_CRESCIMENTO))
        .toBeGreaterThanOrEqual(948 - FOLGA);
    });

    it('não aplica a redução a partir dos 2 anos', () => {
      const semReducao = calcular(f('fao_2004_crianca'), { pesoKg: 13.5, idade: 2, sexo: 'male' }, 1);
      const comReducao = calcular(f('fao_2004_crianca'), { pesoKg: 13.5, idade: 1.9, sexo: 'male' }, 1);
      expect(semReducao.get!).toBeGreaterThan(comReducao.get!);
    });

    it('o ganho de peso vem da Tabela 4.1, não é digitado', () => {
      expect(ganhoPesoGDia('male', 14.5)).toBe(16.2);   // pico do estirão
      expect(ganhoPesoGDia('female', 17.5)).toBe(0);    // crescimento encerrado
      expect(ganhoPesoGDia('male', 25)).toBeNull();     // fora da tabela
    });

    it('antes dos 6 anos a FAO só publica atividade moderada', () => {
      const prot = f('fao_2004_crianca');
      expect(fatoresDe(prot, 4)).toHaveLength(1);
      expect(fatoresDe(prot, 4)[0].valor).toBe(1);
      expect(fatoresDe(prot, IDADE_MINIMA_AJUSTE_INFANTIL)).toHaveLength(3);
    });

    it('o fator infantil MULTIPLICA o GET, não converte TMB em GET', () => {
      const prot = f('fao_2004_crianca');
      const moderada = calcular(prot, { pesoKg: 30, idade: 10, sexo: 'male' }, 1);
      const vigorosa = calcular(prot, { pesoKg: 30, idade: 10, sexo: 'male' }, 1.15);
      expect(vigorosa.get).toBe(Math.round(moderada.get! * 1.15));
      // GET direto: nunca reporta TMB, porque a equação não estima TMB.
      expect(moderada.tmb).toBeNull();
    });

    it('recusa fora da faixa de 1 a 17 anos em vez de extrapolar', () => {
      const prot = f('fao_2004_crianca');
      const adulto = calcular(prot, { pesoKg: 70, idade: 30, sexo: 'male' }, 1);
      expect(adulto.get).toBeNull();
      expect(adulto.naoSeAplica).toMatch(/até 18 anos/);
    });
  });

  // ─── EER/DRI 2023: contraprova pelos exemplos resolvidos da publicação ───

  describe('EER/DRI 2023', () => {
    const eer = () => f('eer_dri_2023');

    /**
     * Os quatro exemplos que o relatório resolve no capítulo 7.
     *
     * Esta é a contraprova que vale: são contas feitas pelos próprios autores,
     * com todos os termos. Bater nos quatro, cobrindo os dois sexos, três
     * faixas etárias e três categorias de atividade, exercita adulto, idoso,
     * adolescente e criança — e qualquer dígito trocado em qualquer um dos
     * blocos de coeficientes derruba pelo menos um deles.
     */
    const EXEMPLOS: Array<[
      descricao: string, entrada: Parameters<typeof calcular>[1], esperado: number,
    ]> = [
      ['mulher 22a, 165 cm, 63 kg, pouco ativa',
        { pesoKg: 63, alturaCm: 165, idade: 22, sexo: 'female', categoriaAtividade: 'pouco_ativo' }, 2275],
      ['menino 15a, 170 cm, 66 kg, ativo',
        { pesoKg: 66, alturaCm: 170, idade: 15, sexo: 'male', categoriaAtividade: 'ativo' }, 3190],
      ['menino 2a, 98 cm, 15,5 kg (sem categoria)',
        { pesoKg: 15.5, alturaCm: 98, idade: 2, sexo: 'male' }, 1281],
      ['mulher 70a, 157 cm, 70 kg, inativa',
        { pesoKg: 70, alturaCm: 157, idade: 70, sexo: 'female', categoriaAtividade: 'inativo' }, 1812],
    ];

    it.each(EXEMPLOS)('reproduz o exemplo da publicação — %s = %s kcal',
      (_descricao, entrada, esperado) => {
        expect(calcular(eer(), entrada, null).get).toBe(esperado);
      });

    it('altura em CENTÍMETROS: em metros o resultado despenca e continua plausível', () => {
      // O erro clássico nesta família. Em metros, 165 vira 1,65 e o termo da
      // altura perde ~1.080 kcal — o total sai 1.186, que não parece absurdo.
      const cm = calcular(eer(),
        { pesoKg: 63, alturaCm: 165, idade: 22, sexo: 'female', categoriaAtividade: 'pouco_ativo' }, null);
      const metros = calcular(eer(),
        { pesoKg: 63, alturaCm: 1.65, idade: 22, sexo: 'female', categoriaAtividade: 'pouco_ativo' }, null);
      expect(cm.get).toBe(2275);
      expect(metros.get).toBeLessThan(1300);
    });

    it('a categoria escolhe a equação, não multiplica o resultado', () => {
      expect(eer().ajuste).toBe('seleciona_equacao');
      const base = { pesoKg: 70, alturaCm: 175, idade: 30, sexo: 'male' as Sexo };
      const vals = ['inativo', 'pouco_ativo', 'ativo', 'muito_ativo']
        .map((c) => calcular(eer(), { ...base, categoriaAtividade: c }, null).get!);

      // Se fossem multiplicadores de uma mesma base, as razões entre as
      // categorias seriam as mesmas para qualquer paciente. Não são: cada
      // categoria tem intercepto e coeficientes próprios.
      const base2 = { pesoKg: 110, alturaCm: 190, idade: 60, sexo: 'male' as Sexo };
      const vals2 = ['inativo', 'pouco_ativo', 'ativo', 'muito_ativo']
        .map((c) => calcular(eer(), { ...base2, categoriaAtividade: c }, null).get!);

      expect(vals2[3] / vals2[0]).not.toBeCloseTo(vals[3] / vals[0], 2);
      expect(new Set(vals).size).toBe(4);
    });

    it('sem categoria, cobra a categoria — não calcula por omissão', () => {
      const r = calcular(eer(), E({ categoriaAtividade: null }), null);
      expect(r.get).toBeNull();
      expect(r.faltando).toEqual(['a categoria de atividade']);
      expect(r.naoSeAplica).toBeNull();
    });

    it('abaixo de 3 anos não oferece categoria, e calcula sem ela', () => {
      expect(fatoresDe(eer(), 2)).toHaveLength(0);
      expect(fatoresDe(eer(), 3)).toHaveLength(4);
      const r = calcular(eer(), { pesoKg: 15.5, alturaCm: 98, idade: 2, sexo: 'male' }, null);
      expect(r.get).toBe(1281);
    });

    it('usa o conjunto de jovem até 18,99 e o de adulto a partir de 19', () => {
      // Mesma pessoa hipotética dos dois lados do corte: os conjuntos são
      // diferentes, então o valor tem de saltar.
      const antes = calcular(eer(),
        { pesoKg: 60, alturaCm: 170, idade: 18.9, sexo: 'male', categoriaAtividade: 'ativo' }, null);
      const depois = calcular(eer(),
        { pesoKg: 60, alturaCm: 170, idade: 19, sexo: 'male', categoriaAtividade: 'ativo' }, null);
      expect(antes.get).not.toBe(depois.get);
    });

    it('a energia de crescimento muda por faixa e zera no adulto', () => {
      expect(crescimentoEer('male', 3)).toBe(20);
      expect(crescimentoEer('male', 5)).toBe(15);
      expect(crescimentoEer('male', 10)).toBe(25);
      expect(crescimentoEer('female', 10)).toBe(30);
      expect(crescimentoEer('male', 16)).toBe(20);
      expect(crescimentoEer('male', 25)).toBe(0);
    });

    it('o fator numérico das categorias nunca entra na conta', () => {
      // `valor` existe só para ordenar. Se alguém multiplicar por ele, estes
      // dois resultados passariam a diferir.
      const entrada = {
        pesoKg: 63, alturaCm: 165, idade: 22, sexo: 'female' as Sexo,
        categoriaAtividade: 'pouco_ativo',
      };
      expect(calcular(eer(), entrada, null).get).toBe(2275);
      expect(calcular(eer(), entrada, 1.9).get).toBe(2275);
    });
  });

  // ─── gestante e lactante ─────────────────────────────────────────────────

  describe('EER 2023 — gestante', () => {
    const g = () => f('eer_2023_gestante');
    const base = {
      pesoKg: 70, alturaCm: 165, idade: 30, sexo: 'female' as Sexo,
      categoriaAtividade: 'inativo', semanaGestacional: 28,
      estadoPreGestacional: 'eutrofia' as const,
    };

    it('soma a idade gestacional e a energia de depósito', () => {
      // 1.131,20 − 2,04×30 + 0,34×165 + 12,15×70 + 9,16×28 + 200
      expect(calcular(g(), base, null).get).toBe(2433);
    });

    it('cada semana de gestação vale 9,16 kcal', () => {
      const s28 = calcular(g(), base, null).get!;
      const s29 = calcular(g(), { ...base, semanaGestacional: 29 }, null).get!;
      expect(s29 - s28).toBe(9);
    });

    it('o depósito muda com o estado pré-gestacional, e a diferença é exata', () => {
      const dif = (e: 'baixo_peso' | 'sobrepeso' | 'obesidade') =>
        calcular(g(), { ...base, estadoPreGestacional: e }, null).get!
        - calcular(g(), base, null).get!;
      expect(dif('baixo_peso')).toBe(100);   // 300 − 200
      expect(dif('sobrepeso')).toBe(-50);    // 150 − 200
      expect(dif('obesidade')).toBe(-150);   // 50 − 200
    });

    it('a divergência da obesidade continua declarada', () => {
      // Catraca: se alguém trocar o valor sem resolver a divergência, isto
      // cai. Resolver exige mudar o teste, e mudar o teste exige explicar.
      expect(DEPOSITO_GESTACIONAL.obesidade).toBe(DEPOSITO_OBESIDADE_DIVERGENTE.usado);
      expect(DEPOSITO_OBESIDADE_DIVERGENTE.alternativo).toBe(-50);
      // A profissional decidiu adotar +50 e tirar o aviso da tela. A
      // segunda leitura publicada continua registrada no codigo, para que
      // ninguem "corrija" o +50 achando que achou erro de digitacao.
      expect(DEPOSITO_OBESIDADE_DIVERGENTE.decidido).toMatch(/\+50/);
      expect(g().constantes.join(' ')).not.toMatch(/diverge/i);
    });

    it('sem semana gestacional ou estado, cobra o dado', () => {
      const semSemana = calcular(g(), { ...base, semanaGestacional: null }, null);
      expect(semSemana.get).toBeNull();
      expect(semSemana.faltando.length).toBeGreaterThan(0);
    });
  });

  describe('EER 2023 — lactante', () => {
    const l = () => f('eer_2023_lactante');
    const base = {
      pesoKg: 65, alturaCm: 165, idade: 30, sexo: 'female' as Sexo,
      categoriaAtividade: 'pouco_ativo', mesesPosParto: 3,
    };

    it('é a equação da não lactante mais o custo do leite', () => {
      // A relação é o que a fonte define; checá-la prova que a equação base
      // é reaproveitada em vez de recopiada com um dígito trocado.
      const naoLactante = calcular(f('eer_dri_2023'),
        { pesoKg: 65, alturaCm: 165, idade: 30, sexo: 'female', categoriaAtividade: 'pouco_ativo' },
        null).get!;
      expect(calcular(l(), base, null).get).toBe(naoLactante + 540 - 140);
    });

    it('depois dos 6 meses some a mobilização e o acréscimo cai para 380', () => {
      const ate6 = calcular(l(), base, null).get!;
      const depois = calcular(l(), { ...base, mesesPosParto: 9 }, null).get!;
      expect(ate6 - depois).toBe(400 - 380);
    });

    it('o corte dos 6 meses é inclusivo embaixo', () => {
      const seis = calcular(l(), { ...base, mesesPosParto: 6 }, null).get!;
      const sete = calcular(l(), { ...base, mesesPosParto: 7 }, null).get!;
      expect(seis - sete).toBe(20);
    });

    it('abaixo de 19 anos usa o conjunto de adolescente', () => {
      const adolescente = calcular(l(), { ...base, idade: 17 }, null).get!;
      const adulta = calcular(l(), { ...base, idade: 19 }, null).get!;
      expect(adolescente).not.toBe(adulta);
    });

    it('não se aplica a homem', () => {
      const r = calcular(l(), { ...base, sexo: 'male' }, null);
      expect(r.get).toBeNull();
      expect(r.naoSeAplica).toMatch(/mulheres/);
    });

    it('recusa pós-parto fora de 0 a 12 meses', () => {
      expect(calcular(l(), { ...base, mesesPosParto: 18 }, null).get).toBeNull();
    });
  });

  // ─── Harris-Benedict: a original lida, a revisão não ─────────────────────

  describe('Harris-Benedict', () => {
    it('a de 1918 traz os coeficientes do artigo, dígito por dígito', () => {
      // Transcritos do fac-símile da p. 373 (PNAS 1918;4(12):370-373).
      // Repetir a conta aqui não valida o coeficiente — o que valida é o
      // texto da equação estar na tela, conferível contra o artigo. Este
      // teste trava que ele NÃO mude sem alguém reler a fonte.
      const c = f('harris_benedict_1918').constantes.join(' ');
      expect(c).toContain('66,4730');
      expect(c).toContain('13,7516');
      expect(c).toContain('5,0033');
      expect(c).toContain('6,7550');
      expect(c).toContain('655,0955');
      expect(c).toContain('9,5634');
      expect(c).toContain('1,8496');
      expect(c).toContain('4,6756');
      expect(c).toMatch(/CENTÍMETROS/);
    });

    it('calcula com os coeficientes de 1918', () => {
      const h = calcular(f('harris_benedict_1918'),
        { pesoKg: 70, alturaCm: 175, idade: 30, sexo: 'male' }, null);
      expect(h.tmb).toBe(Math.round(66.4730 + 13.7516 * 70 + 5.0033 * 175 - 6.7550 * 30));

      const m = calcular(f('harris_benedict_1918'),
        { pesoKg: 60, alturaCm: 165, idade: 35, sexo: 'female' }, null);
      expect(m.tmb).toBe(Math.round(655.0955 + 9.5634 * 60 + 1.8496 * 165 - 4.6756 * 35));
    });

    it('a original e a revisão de 1984 NÃO dão o mesmo valor', () => {
      // As duas circulam com o mesmo nome. Se um dia alguém copiar os
      // coeficientes de uma para a outra, isto cai.
      const entrada = { pesoKg: 70, alturaCm: 175, idade: 30, sexo: 'male' as Sexo };
      const original = calcular(f('harris_benedict_1918'), entrada, null).tmb!;
      const revisada = calcular(f('harris_benedict_1984'), entrada, null).tmb!;
      expect(original).not.toBe(revisada);
      // Próximas, porém: uma diferença grande indicaria erro de transcrição.
      expect(Math.abs(original - revisada)).toBeLessThan(60);
    });

    it('só a de 1918 está verificada; a revisão continua pendente', () => {
      expect(f('harris_benedict_1918').verificacao).toBe('fonte_lida');
      expect(f('harris_benedict_1918').fonte).toMatch(/1918/);
      expect(f('harris_benedict_1984').verificacao).toBe('pendente');
    });

    it('a faixa tabulada pelo artigo fica registrada', () => {
      expect(FAIXA_TABULADA_HB_1918.pesoKg).toEqual([25.0, 124.9]);
      expect(FAIXA_TABULADA_HB_1918.estaturaCm).toEqual([151, 200]);
      expect(FAIXA_TABULADA_HB_1918.idadeAnos).toEqual([21, 70]);
      // Declarada, não imposta: o artigo diz onde TABULOU as equações, não
      // que elas sejam inválidas fora disso. Bloquear uma paciente de 75
      // anos seria inventar uma restrição que a fonte não faz.
      const idosa = calcular(f('harris_benedict_1918'),
        { pesoKg: 62, alturaCm: 158, idade: 75, sexo: 'female' }, null);
      expect(idosa.tmb).not.toBeNull();
      expect(idosa.naoSeAplica).toBeNull();
    });
  });

  // ─── entradas manuais: o piso que destrava o uso ─────────────────────────

  describe('entradas manuais', () => {
    it('TMB informada ainda recebe fator de atividade', () => {
      const r = calcular(f('tmb_manual'), { valorInformado: 1500 }, 1.55);
      expect(r.tmb).toBe(1500);
      expect(r.get).toBe(Math.round(1500 * 1.55));
    });

    it('GET informado NÃO recebe fator — aplicá-lo dobraria a conta', () => {
      const r = calcular(f('get_manual'), { valorInformado: 2400 }, 1.55);
      expect(r.get).toBe(2400);
      expect(r.tmb).toBeNull();
      expect(fatoresDe(f('get_manual'), 30)).toHaveLength(0);
    });

    it('fórmula de bolso multiplica peso por kcal/kg', () => {
      const r = calcular(f('bolso'), { pesoKg: 80, valorInformado: 30 }, null);
      expect(r.get).toBe(2400);
    });

    it('as duas manuais não dependem de nenhum coeficiente', () => {
      for (const id of ['tmb_manual', 'get_manual']) {
        expect(f(id).verificacao).toBe('fonte_lida');
        expect(f(id).exige).toEqual(['valor']);
      }
    });
  });

  // ─── procedência: a tela precisa poder dizer a verdade ───────────────────

  describe('procedência dos coeficientes', () => {
    it('as FAO e as EER estão marcadas como lidas na fonte', () => {
      for (const id of [
        'fao_who_unu_2004', 'fao_2004_crianca', 'eer_dri_2023',
      ]) {
        expect(f(id).verificacao).toBe('fonte_lida');
        expect(f(id).fonte).toMatch(/lid[ao]/i);
      }
    });

    it('as de artigo seguem PENDENTES até eu ler a publicação', () => {
      // Esta asserção é uma catraca: se alguém marcar uma delas como
      // 'fonte_lida' sem ter lido, o teste cai. Mudar o status exige mudar
      // este teste, e mudar este teste exige explicar por quê.
      for (const id of ['mifflin_1990', 'harris_benedict_1984', 'katch_mcardle', 'cunningham_1980']) {
        expect(f(id).verificacao).toBe('pendente');
        expect(f(id).fonte).toMatch(/não foi lid[ao]/i);
      }
    });

    it('toda fórmula declara fonte e pelo menos uma constante visível', () => {
      for (const prot of FORMULAS) {
        expect(prot.fonte.length).toBeGreaterThan(20);
        expect(prot.constantes.length).toBeGreaterThan(0);
        for (const c of prot.constantes) expect(c.trim()).not.toBe('');
      }
    });

    it('as pendentes continuam listadas com motivo, para a tela mostrar', () => {
      expect(PENDENTES.length).toBeGreaterThan(0);
      for (const p of PENDENTES) {
        expect(p.nome.trim()).not.toBe('');
        expect(p.motivo.length).toBeGreaterThan(15);
      }
    });

    it('nenhuma pendente duplica uma fórmula já implementada', () => {
      // Lista que anuncia como ausente algo que está no ar faz a
      // profissional calcular por fora sem necessidade.
      const nomes = FORMULAS.map((x) => x.nome.toLowerCase());
      for (const p of PENDENTES) {
        expect(nomes).not.toContain(p.nome.toLowerCase());
      }
    });
  });

  // ─── invariantes estruturais ─────────────────────────────────────────────

  describe('invariantes', () => {
    it('ids são únicos', () => {
      const ids = FORMULAS.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('escala "nenhuma" e ajuste "nenhum" andam juntos', () => {
      // Oferecer fator que não é aplicado, ou aplicar fator sem oferecer
      // escala, são os dois jeitos de silenciosamente errar o GET.
      for (const prot of FORMULAS) {
        if (prot.escalaAtividade === 'nenhuma') expect(prot.ajuste).toBe('nenhum');
        if (prot.ajuste === 'nenhum') expect(ESCALAS[prot.escalaAtividade]).toHaveLength(0);
      }
    });

    it('quem estima TMB multiplica a TMB; quem estima GET nunca', () => {
      for (const prot of FORMULAS) {
        if (prot.ajuste === 'multiplica_tmb') expect(prot.estima).toBe('tmb');
        if (prot.estima === 'tmb') expect(prot.ajuste).toBe('multiplica_tmb');
      }
    });

    it('todo fator de uma escala é recuperável pelo id', () => {
      for (const prot of FORMULAS) {
        for (const fa of ESCALAS[prot.escalaAtividade]) {
          expect(fatorPorId(prot, fa.id)).toBe(fa.valor);
        }
        expect(fatorPorId(prot, 'inexistente')).toBeNull();
      }
    });

    it('falta de dado e não-aplicação são situações distintas', () => {
      const semPeso = calcular(f('fao_who_unu_2004'), E({ pesoKg: null }), 1.55);
      expect(semPeso.faltando).toEqual(['peso']);
      expect(semPeso.naoSeAplica).toBeNull();

      // Idade fora da faixa publicada: todos os dados presentes, e mesmo
      // assim a equação não se aplica.
      const foraDaFaixa = calcular(f('fao_2004_crianca'), E({ idade: 40 }), 1);
      expect(foraDaFaixa.faltando).toEqual([]);
      expect(foraDaFaixa.naoSeAplica).not.toBeNull();
    });

    it('nenhuma fórmula devolve valor com dado ausente', () => {
      for (const prot of FORMULAS) {
        const r = calcular(prot, {}, 1.55);
        expect(r.tmb).toBeNull();
        expect(r.get).toBeNull();
      }
    });

    it('as de MLG não dependem de sexo, e as de peso dependem', () => {
      for (const id of ['katch_mcardle', 'cunningham_1980']) {
        expect(f(id).exige).not.toContain('sexo');
      }
      for (const id of ['mifflin_1990', 'harris_benedict_1984', 'fao_who_unu_2004']) {
        expect(f(id).exige).toContain('sexo');
      }
    });

    it('Mifflin separa homem de mulher por 166 kcal', () => {
      // 5 − (−161). Não valida o coeficiente; trava a diferença entre sexos,
      // que é onde o bug "toda paciente tratada como mulher" apareceu antes.
      const h = calcular(f('mifflin_1990'), E({ sexo: 'male' }), null);
      const m = calcular(f('mifflin_1990'), E({ sexo: 'female' }), null);
      expect(h.tmb! - m.tmb!).toBe(166);
    });
  });
});
