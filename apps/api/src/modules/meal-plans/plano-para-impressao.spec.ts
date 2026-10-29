import {
  montarImpressaoDoPlano, escreverQuantidade, escreverTrocas,
  SemIdentidadeProfissional, MAXIMO_DE_TROCAS,
  type EntradaDaImpressao,
} from '../../../../web/lib/plano-para-impressao';

/**
 * A folha que vai para a mão do paciente.
 *
 * Um erro aqui sai impresso na casa de alguém — não na tela de quem poderia
 * notar. Por isso a montagem é função pura e testada, e não lógica dentro do
 * botão.
 */

const PROFISSIONAL = {
  nome: 'Claudia Santos', conselho: 'CRN', conselhoNumero: '12345', conselhoUf: 'GO',
};

function entrada(over: Partial<EntradaDaImpressao> = {}): EntradaDaImpressao {
  return {
    plano: { id: 'abcdef12-3456', nome: 'Semanal', dataFim: null },
    refeicoes: [
      {
        refeicao: 'cafe_manha', rotulo: 'Café da manhã', horario: '07:00',
        itens: [{ alimentoNome: 'OVO DE GALINHA, cozido(a)', quantidadeG: 100, medidaCaseira: '2 unidades' }],
      },
    ],
    substituicoesPorAlimento: {},
    paciente: { nome: 'Maria', codigo: 'PAC-1', idade: 34, sexo: 'female' },
    profissional: PROFISSIONAL,
    ...over,
  };
}

describe('quem assina', () => {
  it('RECUSA emitir sem identidade profissional', () => {
    // O PDF antigo assinava com a constante "Dra. Ana Costa · CRN-3 12345"
    // em toda prescricao, de qualquer profissional. Registro de conselho
    // identifica legalmente quem assina.
    expect(() => montarImpressaoDoPlano(entrada({ profissional: null })))
      .toThrow(SemIdentidadeProfissional);
  });

  it('RECUSA quando falta o numero do conselho', () => {
    expect(() => montarImpressaoDoPlano(entrada({
      profissional: { ...PROFISSIONAL, conselhoNumero: null },
    }))).toThrow(/registro de conselho/);
  });

  it('assina com o nome e o registro de quem emitiu', () => {
    // O registro vai COMPOSTO em `councilNumber`, e `council` fica vazio de
    // proposito: o cabecalho do PDF imprime os dois lado a lado, e concatenar
    // dava "CFN CRN-3 12345" -- acronimo duplicado, com o conselho FEDERAL na
    // frente do registro REGIONAL. Ver web/lib/registro-profissional.ts.
    const d = montarImpressaoDoPlano(entrada());
    expect(d.professional.name).toBe('Claudia Santos');
    expect(d.professional.council).toBe('');
    expect(d.professional.councilNumber).toBe('CRN 12345/GO');
  });

  it('nao duplica o acronimo quando o numero ja o traz', () => {
    // O caso real da base: tipo "CFN" com numero "CRN-3 12345".
    const d = montarImpressaoDoPlano(entrada({
      profissional: {
        nome: 'X', conselho: 'CFN', conselhoNumero: 'CRN-3 12345', conselhoUf: 'SP',
      },
    }));
    expect(d.professional.councilNumber).toBe('CRN-3 12345/SP');
  });
});

describe('a quantidade, como o paciente le', () => {
  it('traz gramas E medida caseira quando ha as duas', () => {
    expect(escreverQuantidade({ alimentoNome: 'x', quantidadeG: 120, medidaCaseira: '2 colheres de sopa' }))
      .toBe('120 g (2 colheres de sopa)');
  });

  it('so gramas quando nao ha medida', () => {
    expect(escreverQuantidade({ alimentoNome: 'x', quantidadeG: 120 })).toBe('120 g');
  });

  it('so medida quando nao ha gramas', () => {
    expect(escreverQuantidade({ alimentoNome: 'x', medidaCaseira: '1 concha' })).toBe('1 concha');
  });

  it('sem nenhum dos dois, trava visivel em vez de celula vazia', () => {
    expect(escreverQuantidade({ alimentoNome: 'x' })).toBe('—');
  });
});

describe('as trocas na folha', () => {
  it('escreve nome, medida caseira e gramas', () => {
    expect(escreverTrocas([{ nome: 'LENTILHA', quantidadeG: 75, medidaTexto: '4 colheres de sopa' }]))
      .toBe('LENTILHA — 4 colheres de sopa (75 g)');
  });

  it('sem medida caseira, cai para gramas', () => {
    expect(escreverTrocas([{ nome: 'ANDU', quantidadeG: 100 }])).toBe('ANDU — 100 g');
  });

  it(`corta em ${MAXIMO_DE_TROCAS}: a folha e para executar, nao para consultar`, () => {
    const muitas = Array.from({ length: 8 }, (_, i) => ({ nome: `A${i}`, quantidadeG: 10 }));
    const texto = escreverTrocas(muitas);
    expect(texto.split(' · ')).toHaveLength(MAXIMO_DE_TROCAS);
  });

  it('sem troca, devolve vazio e nao um traco solto', () => {
    expect(escreverTrocas(undefined)).toBe('');
    expect(escreverTrocas([])).toBe('');
  });
});

describe('a montagem', () => {
  it('a observacao da profissional vem ANTES da troca', () => {
    // A observacao e instrucao escrita para aquele paciente; a troca e
    // alternativa. Inverter enterraria o que foi dito de proposito.
    const d = montarImpressaoDoPlano(entrada({
      refeicoes: [{
        refeicao: 'almoco', rotulo: 'Almoço', horario: null,
        itens: [{ alimentoNome: 'ARROZ', quantidadeG: 100, observacao: 'sem sal' }],
      }],
      substituicoesPorAlimento: { ARROZ: [{ nome: 'QUINOA', quantidadeG: 90 }] },
    }));
    expect(d.meals![0].items[0].notes).toBe('sem sal | QUINOA — 90 g');
  });

  it('refeicao vazia nao vira secao em branco na folha', () => {
    const d = montarImpressaoDoPlano(entrada({
      refeicoes: [
        { refeicao: 'cafe_manha', rotulo: 'Café da manhã', itens: [] },
        { refeicao: 'almoco', rotulo: 'Almoço', itens: [{ alimentoNome: 'ARROZ', quantidadeG: 100 }] },
      ],
    }));
    expect(d.meals).toHaveLength(1);
    expect(d.meals![0].name).toBe('Almoço');
  });

  it('leva os totais do dia para o resumo', () => {
    const d = montarImpressaoDoPlano(entrada({
      totais: { kcal: 1800, proteinasG: 90, carboidratosG: 220, lipidiosG: 60 },
    }));
    expect(d.nutritionSummary).toEqual({ kcal: 1800, protein: 90, carb: 220, fat: 60 });
  });

  it('sem data de fim, a validade sai como traco e nao como "Invalid Date"', () => {
    expect(montarImpressaoDoPlano(entrada()).validity).toBe('—');
  });
});
