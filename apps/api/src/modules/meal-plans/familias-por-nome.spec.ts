import { classificarGrupoTroca, type ParaClassificar } from './grupos-troca';
import { familiaDoNome, nomeBase, FAMILIAS } from './familias-por-nome';

/**
 * Classificação por nome, para alimento sem grupo da TACO.
 *
 * Cada caso aqui é um nome REAL da base, e a maioria é um defeito que a
 * medição contra a base achou — não um exemplo que eu inventei. Os testes de
 * substituição já existentes usam alimentos fabricados, todos com grupo
 * preenchido, e foi por isso que nada disto apareceu antes.
 */

/** Alimento sem grupo da TACO, que é o caso de todo registro do IBGE. */
function semGrupoTaco(nome: string, macros: Partial<ParaClassificar> = {}): ParaClassificar {
  return {
    nomePadronizado: nome,
    grupoAlimentar: null,
    energiaKcal: 150,
    proteinasG: 5,
    carboidratosG: 20,
    lipidiosG: 2,
    ...macros,
  };
}

describe('nomeBase', () => {
  it('descarta a preparação, que não muda o grupo de troca', () => {
    expect(nomeBase('BATATA-INGLESA, cozido(a)')).toBe('BATATA-INGLESA');
    expect(nomeBase('BATATA-INGLESA, frito(a)')).toBe('BATATA-INGLESA');
  });

  it('tira acento, porque a base é inconsistente', () => {
    // "ABA DE FILÉ" e "FILE DE FRANGO" convivem na mesma base.
    expect(nomeBase('ABA DE FILÉ')).toBe('ABA DE FILE');
  });
});

describe('o prefixo termina onde a palavra termina', () => {
  it('SAL não engole SALSICHA, SALSÃO nem SALSA', () => {
    // O defeito: `^SAL` dava "é tempero, não é porção de alimento" para os 12
    // registros de SALSICHA NO VAREJO, que então não tinham troca nenhuma.
    expect(classificarGrupoTroca(semGrupoTaco('SALSICHA NO VAREJO, cru(a)')).grupo)
      .toBe('Açúcares e ultraprocessados');
    expect(classificarGrupoTroca(semGrupoTaco('SALSAO (AIPO)')).grupo)
      .toBe('Hortaliças e vegetais');
    expect(classificarGrupoTroca(semGrupoTaco('SALSA')).grupo)
      .toBe('Hortaliças e vegetais');
    // E o sal continua recusado.
    expect(classificarGrupoTroca(semGrupoTaco('SAL, grosso')).grupo).toBeNull();
  });

  it('PIMENTA não engole PIMENTÃO', () => {
    expect(classificarGrupoTroca(semGrupoTaco('PIMENTAO')).grupo)
      .toBe('Hortaliças e vegetais');
    expect(classificarGrupoTroca(semGrupoTaco('PIMENTA DO REINO')).grupo).toBeNull();
  });

  it('CARNE casa com "CARNE SECA" e não com "CARNEIRO" por prefixo', () => {
    // CARNEIRO está listado à parte, de propósito: a família diz o que quer.
    expect(familiaDoNome('CARNE SECA, cozido(a)')?.decisao.tipo).toBe('proteina');
    expect(familiaDoNome('CARNE DE CARNEIRO')?.decisao.tipo).toBe('proteina');
  });
});

describe('origem manda sobre percentual', () => {
  it('CARNE SECA é proteína, não gordura', () => {
    // O defeito que motivou o arquivo: 65% da energia em gordura e nenhum
    // grupo da TACO, então a regra de lipídio quase puro a oferecia como
    // troca de azeite e castanha.
    const c = classificarGrupoTroca(semGrupoTaco('CARNE SECA, cozido(a)', {
      proteinasG: 26.9, carboidratosG: null, lipidiosG: 21.9, energiaKcal: 303,
    }));
    expect(c.grupo).toBe('Proteínas gordas');
    expect(c.derivadoDoNome).toBe(true);
  });

  it('bisteca, cupim, paio e pé de galinha são proteína', () => {
    // Os seis nomes que a inspeção achou em "Gorduras e oleaginosas" quando
    // ainda havia regra de composição de reserva.
    const gordos = { proteinasG: 15, carboidratosG: 0, lipidiosG: 30, energiaKcal: 330 };
    for (const nome of [
      'BISTECA BOVINA', 'CUPIM', 'RABADA DE BOI', 'PAIO',
      'PE DE GALINHA OU FRANGO', 'PATE (FÍGADO)',
    ]) {
      expect(classificarGrupoTroca(semGrupoTaco(nome, gordos)).grupo)
        .toMatch(/^Proteínas/);
    }
  });

  it('muçarela é queijo, mesmo sem a palavra QUEIJO no começo', () => {
    expect(classificarGrupoTroca(semGrupoTaco('MUSSARELA', {
      energiaKcal: 330, proteinasG: 25, carboidratosG: 3, lipidiosG: 25,
    })).grupo).toBe('Queijos');
  });

  it('manteiga, nata e creme de leite são gordura, não lácteo de troca', () => {
    // Pela densidade eles cairiam em "Queijos" e a manteiga apareceria como
    // troca de muçarela.
    for (const nome of ['MANTEIGA COM OU SEM SAL', 'NATA', 'CREME DE LEITE']) {
      expect(classificarGrupoTroca(semGrupoTaco(nome, {
        energiaKcal: 717, proteinasG: 0.9, carboidratosG: 0.1, lipidiosG: 81,
      })).grupo).toBe('Gorduras e oleaginosas');
    }
  });
});

describe('a ordem das famílias', () => {
  it('DOCE DE LEITE é açúcar, não lácteo', () => {
    expect(classificarGrupoTroca(semGrupoTaco('DOCE DE LEITE')).grupo)
      .toBe('Açúcares e ultraprocessados');
  });

  it('CARNE DE SOJA é leguminosa, não carne', () => {
    expect(classificarGrupoTroca(semGrupoTaco('CARNE DE SOJA')).grupo)
      .toBe('Leguminosas');
    expect(classificarGrupoTroca(semGrupoTaco('BIFE VEGETAL')).grupo)
      .toBe('Leguminosas');
  });

  it('ERVILHA EM VAGEM é hortaliça; ERVILHA EM GRAO é leguminosa', () => {
    expect(classificarGrupoTroca(semGrupoTaco('ERVILHA EM VAGEM')).grupo)
      .toBe('Hortaliças e vegetais');
    expect(classificarGrupoTroca(semGrupoTaco('ERVILHA EM GRAO')).grupo)
      .toBe('Leguminosas');
  });

  it('CANA DE ACUCAR é açúcar, não bebida', () => {
    expect(classificarGrupoTroca(semGrupoTaco('CANA DE ACUCAR')).grupo)
      .toBe('Açúcares e ultraprocessados');
    expect(classificarGrupoTroca(semGrupoTaco('CANA, aguardente 1')).grupo)
      .toBe('Bebidas');
  });

  it('CASTANHA PORTUGUESA é amido; as outras castanhas são oleaginosas', () => {
    expect(classificarGrupoTroca(semGrupoTaco('CASTANHA PORTUGUESA')).grupo)
      .toBe('Cereais, pães e tubérculos');
    expect(classificarGrupoTroca(semGrupoTaco('CASTANHA DO PARA')).grupo)
      .toBe('Gorduras e oleaginosas');
  });

  it('fruta gordurosa vai para oleaginosas, por decisão da profissional', () => {
    for (const nome of ['ABACATE', 'COCO DA BAHIA (SECO OU VERDE)', 'ACAI', 'PEQUI']) {
      expect(classificarGrupoTroca(semGrupoTaco(nome)).grupo)
        .toBe('Gorduras e oleaginosas');
    }
  });
});

describe('o freio', () => {
  it('nome desconhecido NÃO recebe grupo, e diz por quê', () => {
    const c = classificarGrupoTroca(semGrupoTaco('XIRIMBABO DO AGRESTE'));
    expect(c.grupo).toBeNull();
    expect(c.motivo).toMatch(/não casa com nenhuma família/);
  });

  it('nome desconhecido com muita gordura também NÃO recebe grupo', () => {
    // A regra de composição de reserva saiu daqui de propósito: ela acertava
    // as castanhas e errava bisteca, paio, muçarela e pavê.
    const c = classificarGrupoTroca(semGrupoTaco('XIRIMBABO DO AGRESTE', {
      proteinasG: 1, carboidratosG: 1, lipidiosG: 40, energiaKcal: 370,
    }));
    expect(c.grupo).toBeNull();
  });

  it('tempero e suplemento são recusados com motivo próprio', () => {
    expect(classificarGrupoTroca(semGrupoTaco('SHOYU')).motivo)
      .toMatch(/tempero|condimento/);
    expect(classificarGrupoTroca(semGrupoTaco('SUSTAGEM')).motivo)
      .toMatch(/suplemento|fórmula/);
  });

  it('sem macronutriente nenhum, recusa antes de olhar o nome', () => {
    const c = classificarGrupoTroca(semGrupoTaco('LEITE, de vaca, desnatado, UHT', {
      energiaKcal: null, proteinasG: null, carboidratosG: null, lipidiosG: null,
    }));
    expect(c.grupo).toBeNull();
    expect(c.motivo).toMatch(/não registra macronutrientes/);
  });
});

describe('a marca de derivado', () => {
  it('grupo vindo do nome é marcado; grupo vindo da TACO não', () => {
    // A tela precisa poder mostrar que a origem foi deduzida por mim, para a
    // profissional desconfiar da troca antes de mandá-la ao paciente.
    expect(classificarGrupoTroca(semGrupoTaco('BATATA-INGLESA, cozido(a)')).derivadoDoNome)
      .toBe(true);
    const comTaco = classificarGrupoTroca({
      ...semGrupoTaco('Arroz, integral, cozido'),
      grupoAlimentar: 'Cereais e derivados',
    });
    expect(comTaco.grupo).toBe('Cereais, pães e tubérculos');
    expect(comTaco.derivadoDoNome).toBeUndefined();
  });
});

describe('higiene das listas', () => {
  it('nenhum prefixo é sombreado por outro da MESMA família', () => {
    // "SAL" e "SAL GROSSO" na mesma lista: o segundo nunca é alcançado,
    // porque o primeiro já casa. Não é defeito, é lista pedindo limpeza —
    // e esconde a intenção de quem leu que os dois estavam cobertos.
    const sombreados: string[] = [];
    for (const f of FAMILIAS) {
      for (const p of f.prefixos) {
        const sombra = f.prefixos.find(
          (outro) => outro !== p && p.startsWith(outro)
            && !/^\p{L}/u.test(p.slice(outro.length)),
        );
        if (sombra) sombreados.push(`"${p}" é sombreado por "${sombra}"`);
      }
    }
    expect(sombreados).toEqual([]);
  });

  it('nenhum prefixo aparece em duas famílias com decisões diferentes', () => {
    const onde = new Map<string, string[]>();
    for (const f of FAMILIAS) {
      const rotulo = f.decisao.tipo === 'grupo' ? f.decisao.grupo : f.decisao.tipo;
      for (const p of f.prefixos) {
        onde.set(p, [...(onde.get(p) ?? []), rotulo]);
      }
    }
    const conflitos = [...onde.entries()]
      .filter(([, rotulos]) => new Set(rotulos).size > 1)
      .map(([p, rotulos]) => `${p}: ${[...new Set(rotulos)].join(' x ')}`);
    expect(conflitos).toEqual([]);
  });
});
