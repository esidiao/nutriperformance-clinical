import { sinonimosPara, REGRAS_SINONIMOS } from './sinonimos-populares';

describe('sinônimos populares', () => {
  it('aplica nomes regionais da mandioca', () => {
    const s = sinonimosPara('Mandioca, cozida');
    expect(s).toContain('aipim');
    expect(s).toContain('macaxeira');
  });

  it('encontra a regra mesmo com acento no nome da base', () => {
    expect(sinonimosPara('Abóbora, moranga, crua')).toContain('jerimum');
  });

  it('corrige o erro de digitação da própria TACO', () => {
    // A tabela grava "mingnon"; ninguém digita assim
    expect(sinonimosPara('Carne, bovina, filé mingnon, sem gordura, cru'))
      .toEqual(expect.arrayContaining(['file mignon', 'mignon']));
  });

  it('cobre as grafias correntes da mozarela', () => {
    const s = sinonimosPara('Queijo, mozarela');
    expect(s).toEqual(expect.arrayContaining(['mucarela', 'mussarela', 'muzarela']));
  });

  it('dá ao pão francês os nomes que se usam pelo país', () => {
    const s = sinonimosPara('Pão, trigo, francês');
    expect(s).toEqual(expect.arrayContaining(['pao de sal', 'cacetinho', 'filao']));
  });

  it('não repete termo que o próprio nome já contém', () => {
    // "Tangerina, Poncã, crua" já tem "tangerina": incluí-lo não ajudaria
    expect(sinonimosPara('Tangerina, Poncã, crua')).not.toContain('tangerina');
  });

  it('devolve vazio para alimento sem sinônimo cadastrado', () => {
    expect(sinonimosPara('Alface, crespa, crua')).toEqual([]);
  });

  it('não devolve duplicatas quando duas regras coincidem', () => {
    const s = sinonimosPara('Salsa, crua');
    expect(s.length).toBe(new Set(s).size);
  });

  it('atribui cheiro verde a coentro, salsa e cebolinha', () => {
    expect(sinonimosPara('Coentro, folhas desidratadas')).toContain('cheiro verde');
    expect(sinonimosPara('Cebolinha, crua')).toContain('cheiro verde');
    expect(sinonimosPara('Salsa, crua')).toContain('cheiro verde');
  });

  describe('segurança clínica', () => {
    it('não confunde inhame com cará — são plantas distintas', () => {
      expect(sinonimosPara('Inhame, cru')).not.toContain('cara');
      expect(sinonimosPara('Cará, cru')).not.toContain('inhame');
    });

    it('não trata batata doce como batata inglesa', () => {
      expect(sinonimosPara('Batata, doce, crua')).not.toContain('batata');
    });

    it('não trata pinhão como pinha — semente de araucária x fruta-do-conde', () => {
      // "pinha" casa como prefixo de "pinhão": sem a exceção, o pinhão
      // recebia o sinônimo de outra fruta
      const s = sinonimosPara('Pinhão, cozido');
      expect(s).not.toContain('fruta do conde');
      expect(s).not.toContain('ata');
      // e a pinha de verdade continua recebendo
      expect(sinonimosPara('Pinha, crua')).toContain('fruta do conde');
    });

    it('não trata ervilha-torta como vagem de feijão', () => {
      expect(sinonimosPara('Ervilha, em vagem')).not.toContain('feijao verde');
      expect(sinonimosPara('Vagem, crua')).toContain('feijao verde');
    });

    it('não dá sinônimo de carne bovina a carne suína', () => {
      const suina = sinonimosPara('Porco, lombo, cru');
      expect(suina).not.toContain('acem');
      expect(suina).not.toContain('patinho');
    });
  });

  describe('integridade do dicionário', () => {
    it('nenhuma regra é vazia', () => {
      for (const r of REGRAS_SINONIMOS) {
        expect(r.contem.trim().length).toBeGreaterThan(0);
        expect(r.sinonimos.length).toBeGreaterThan(0);
      }
    });

    it('nenhum sinônimo vem em branco ou repetido dentro da regra', () => {
      for (const r of REGRAS_SINONIMOS) {
        expect(r.sinonimos.every((s) => s.trim().length > 0)).toBe(true);
        expect(r.sinonimos.length).toBe(new Set(r.sinonimos).size);
      }
    });
  });
});
