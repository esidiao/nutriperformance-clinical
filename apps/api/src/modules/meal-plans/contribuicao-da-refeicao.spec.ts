import { contribuicaoDaRefeicao } from '../../../../web/lib/contribuicao-da-refeicao';

/**
 * A contribuição de uma refeição para a recomendação do dia.
 *
 * O teste central é o que ela NÃO faz: não carimba veredicto. RDA e UL são
 * referências diárias; um café da manhã com 15% do cálcio do dia não está
 * "abaixo", está sendo um café da manhã.
 */
describe('contribuicaoDaRefeicao', () => {
  const adulta = { idade: 34, sexo: 'female' as const };

  it('diz o percentual da recomendação DIÁRIA', () => {
    // Cálcio da mulher 31-50: RDA 1000 mg. 250 mg na refeição = 25% do dia.
    const { linhas } = contribuicaoDaRefeicao({ calcioMg: 250 }, adulta.idade, adulta.sexo);
    const calcio = linhas.find((l) => l.nutriente === 'calcioMg')!;
    expect(calcio.ofertado).toBe(250);
    expect(calcio.pctDoDia).toBe(25);
  });

  it('usa a referência do SEXO certo', () => {
    // Proteína: 46 g para mulher, 56 g para homem. 46 g é 100% dela e 82% dele.
    const m = contribuicaoDaRefeicao({ proteinasG: 46 }, 34, 'female').linhas[0];
    const h = contribuicaoDaRefeicao({ proteinasG: 46 }, 34, 'male').linhas[0];
    expect(m.pctDoDia).toBe(100);
    expect(h.pctDoDia).toBe(82);
  });

  it('usa a referência da FAIXA ETÁRIA certa', () => {
    // Cálcio da mulher: 1000 mg até 50 anos, 1200 depois. 600 mg muda de 60%
    // para 50% conforme a idade.
    expect(contribuicaoDaRefeicao({ calcioMg: 600 }, 40, 'female').linhas[0].pctDoDia).toBe(60);
    expect(contribuicaoDaRefeicao({ calcioMg: 600 }, 60, 'female').linhas[0].pctDoDia).toBe(50);
  });

  it('NÃO devolve veredicto: só contribuição', () => {
    // Carimbar "abaixo do recomendado" em cada refeição produziria oito
    // avisos num plano perfeitamente adequado, e a profissional aprenderia a
    // ignorá-los — que é o pior resultado, porque o mesmo aviso precisa
    // funcionar no dia em que o plano estiver errado.
    const { linhas } = contribuicaoDaRefeicao({ calcioMg: 50 }, adulta.idade, adulta.sexo);
    expect(Object.keys(linhas[0]).sort()).toEqual([
      'acimaDoLimiteDiario', 'grupo', 'nutriente', 'ofertado', 'pctDoDia',
      'rotulo', 'unidade',
    ]);
  });

  it('mas MARCA quando uma refeição sozinha passa do limite do dia', () => {
    // É o único juízo que uma refeição sustenta: se ela já passou do UL, o dia
    // passou também — isso é fato, não extrapolação.
    // Cálcio UL (mulher 31-50): 2500 mg.
    const normal = contribuicaoDaRefeicao({ calcioMg: 900 }, 34, 'female').linhas[0];
    const demais = contribuicaoDaRefeicao({ calcioMg: 3000 }, 34, 'female').linhas[0];
    expect(normal.acimaDoLimiteDiario).toBe(false);
    expect(demais.acimaDoLimiteDiario).toBe(true);
  });

  it('nutriente que a refeição não entrega não vira linha', () => {
    // Dezenove zeros escondem os três valores que interessam.
    const { linhas } = contribuicaoDaRefeicao(
      { calcioMg: 250, ferroMg: 0, zincoMg: null }, adulta.idade, adulta.sexo,
    );
    expect(linhas.map((l) => l.nutriente)).toEqual(['calcioMg']);
  });

  it('ordena pela maior contribuição: "de onde vem o ferro deste plano"', () => {
    const { linhas } = contribuicaoDaRefeicao(
      { calcioMg: 100, proteinasG: 46 }, adulta.idade, adulta.sexo,
    );
    expect(linhas[0].nutriente).toBe('proteinasG'); // 100% contra 10%
  });

  it('fora da faixa adulta devolve vazio, em vez de aplicar valor de adulto', () => {
    const { linhas, faixa } = contribuicaoDaRefeicao({ calcioMg: 250 }, 14, 'female');
    expect(faixa).toBeNull();
    expect(linhas).toEqual([]);
  });
});
