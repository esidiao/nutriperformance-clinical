import { termoParaRegex, extrairTermos } from './foods.service';

/**
 * A busca antiga usava `ILIKE '%frase inteira%'`. Como os nomes da TACO são
 * invertidos e separados por vírgula ("Feijão, carioca, cozido"), nenhuma
 * consulta escrita em linguagem natural retornava resultado — medido em 20
 * consultas reais, 0 traziam algo.
 *
 * Estes testes exercitam a regex contra os nomes como estão gravados no banco.
 */
const casa = (nome: string, termo: string) =>
  new RegExp(termoParaRegex(termo), 'i').test(nome);

const casaTodos = (nome: string, query: string) =>
  extrairTermos(query).every((t) => casa(nome, t));

describe('busca de alimentos — termos e acentos', () => {
  describe('extrairTermos', () => {
    it('separa a consulta em termos', () => {
      expect(extrairTermos('feijão carioca cozido')).toEqual(['feijão', 'carioca', 'cozido']);
    });

    it('descarta monossílabos que só somam ruído', () => {
      expect(extrairTermos('arroz e feijão')).toEqual(['arroz', 'feijão']);
    });

    it('descarta conectores que a TACO não usa no nome', () => {
      // "Frango, peito, sem pele, cru" não tem "de": exigi-lo zerava a busca
      expect(extrairTermos('peito de frango')).toEqual(['peito', 'frango']);
      expect(extrairTermos('leite com aveia')).toEqual(['leite', 'aveia']);
      expect(extrairTermos('bife na chapa')).toEqual(['bife', 'chapa']);
    });

    it('não descarta conector acentuado por engano', () => {
      expect(extrairTermos('pão')).toEqual(['pão']);
    });

    it('cai de volta na consulta original se só houver conectores', () => {
      expect(extrairTermos('com de')).toEqual(['com', 'de']);
    });

    it('ignora espaços repetidos e bordas', () => {
      expect(extrairTermos('  arroz   integral  ')).toEqual(['arroz', 'integral']);
    });

    it('limita a 6 termos para não gerar consulta desproporcional', () => {
      expect(extrairTermos('um dois tres quatro cinco seis sete oito')).toHaveLength(6);
    });

    it('devolve vazio quando não há termo útil', () => {
      expect(extrairTermos('a e o')).toEqual([]);
    });
  });

  describe('termoParaRegex — acentuação', () => {
    it('encontra com acento quando digitado sem', () => {
      expect(casa('Feijão, carioca, cozido', 'feijao')).toBe(true);
    });

    it('encontra sem acento quando digitado com', () => {
      expect(casa('Feijao carioca', 'feijão')).toBe(true);
    });

    it('trata ç como c', () => {
      expect(casa('Maçã, Fuji, com casca, crua', 'maca')).toBe(true);
      expect(casa('Maca peruana', 'maçã')).toBe(true);
    });

    it('cobre as variantes de cada vogal', () => {
      expect(casa('Pêssego, em calda', 'pessego')).toBe(true);
      expect(casa('Açúcar, mascavo', 'acucar')).toBe(true);
      expect(casa('Limão, cravo, cru', 'limao')).toBe(true);
    });

    it('não confunde palavras diferentes', () => {
      expect(casa('Arroz, integral, cozido', 'feijao')).toBe(false);
    });

    it('escapa metacaracteres em vez de interpretá-los', () => {
      // Um ponto sem escape casaria com qualquer caractere
      expect(casa('Arroz, integral', 'a.roz')).toBe(false);
      // E um parêntese solto quebraria a regex
      expect(() => new RegExp(termoParaRegex('leite (integral'), 'i')).not.toThrow();
    });
  });

  describe('consultas reais — as que falhavam antes', () => {
    const CASOS: Array<[string, string]> = [
      ['Feijão, carioca, cozido', 'feijão carioca'],
      ['Feijão, preto, cozido', 'feijão preto'],
      ['Arroz, integral, cozido', 'arroz integral'],
      ['Arroz, tipo 1, cozido', 'arroz cozido'],
      ['Pão, de queijo, assado', 'pão de queijo'],
      ['Leite, de vaca, desnatado, pó', 'leite desnatado'],
      ['Queijo, minas, frescal', 'queijo minas'],
      ['Batata, doce, cozida', 'batata doce'],
      ['Ovo, de galinha, inteiro, cozido', 'ovo cozido'],
      ['Iogurte, natural', 'iogurte natural'],
      ['Frango, peito, sem pele, cru', 'peito de frango'],
      ['Chocolate, ao leite', 'chocolate ao leite'],
    ];

    it.each(CASOS)('encontra %s buscando "%s"', (nome, query) => {
      expect(casaTodos(nome, query)).toBe(true);
    });

    it('encontra com os termos fora de ordem', () => {
      expect(casaTodos('Feijão, carioca, cozido', 'carioca feijão')).toBe(true);
    });

    it('encontra mesmo tudo sem acento', () => {
      expect(casaTodos('Feijão, carioca, cozido', 'feijao carioca')).toBe(true);
    });

    it('não devolve alimento que só tem parte dos termos', () => {
      expect(casaTodos('Arroz, integral, cozido', 'arroz branco')).toBe(false);
    });
  });
});
