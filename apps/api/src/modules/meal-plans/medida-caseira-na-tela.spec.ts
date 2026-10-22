import { descreverQuantidade, pluralizarMedida } from '../../../../web/lib/medida-caseira';
import { descreverMedida } from './medida-aproximada';

/**
 * A frase que a TELA escreve, não só a que a API escreve.
 *
 * O defeito que motivou este arquivo: o seletor de medida caseira montava a
 * descrição à mão (`${quantidade} ${medida}`), mostrava "3 colher de sopa" e
 * GRAVAVA isso no registro — enquanto a API, no mesmo monorepo, já tinha o
 * plural certo em `descreverMedida`. Dois caminhos para a mesma frase, e só um
 * tinha teste; o sem teste era o que chegava ao paciente.
 *
 * Achado em 22/10/2026 abrindo a tela, com 1054 testes passando. Por isso o
 * teste aqui exercita a função que a TELA chama, e prova que as duas pontas
 * dizem a mesma coisa.
 */
describe('medida caseira: a frase da tela', () => {
  it('flexiona o substantivo, não a locução', () => {
    expect(descreverQuantidade(3, 'colher de sopa')).toBe('3 colheres de sopa');
    expect(descreverQuantidade(2, 'copo de requeijao')).toBe('2 copos de requeijao');
  });

  it('o adjetivo concorda', () => {
    expect(descreverQuantidade(3, 'unidade media')).toBe('3 unidades medias');
    expect(descreverQuantidade(2, 'prato fundo')).toBe('2 pratos fundos');
  });

  it('quantidade 1 fica no singular', () => {
    expect(descreverQuantidade(1, 'colher de sopa')).toBe('1 colher de sopa');
    expect(descreverQuantidade(1, 'unidade media')).toBe('1 unidade media');
  });

  it('fração usa vírgula, e acima de 1 vai para o plural', () => {
    // "1,5 fatias" é a forma corrente: acima de um, plural. Minha primeira
    // expectativa aqui era "1,5 fatia" — estava errada, e o código certo.
    expect(descreverQuantidade(1.5, 'fatia')).toBe('1,5 fatias');
    expect(descreverQuantidade(0.5, 'concha')).toBe('0,5 concha');
  });

  it('parentético não se mexe', () => {
    expect(descreverQuantidade(2, 'lata (n. e.)')).toBe('2 lata (n. e.)');
  });

  it('não inventa plural que não sabe formar', () => {
    // "ão" não é derivável (pão/pães vs limão/limões) e "l" daria "pasteis".
    expect(pluralizarMedida('pastel')).toBe('pastel');
    expect(pluralizarMedida('pao')).toBe('pao');
    expect(pluralizarMedida('limao')).toBe('limao');
  });

  it('as duas medidas da base terminadas em "ao" saem certas', () => {
    // Conferido na base com scripts/conferir-plurais-das-medidas.mjs: das 99
    // medidas distintas, estas duas terminam em "ao".
    //
    // "porcao" virava "porcaos" em produção — a base vem sem acento, então o
    // guarda de "ão" não pegava e a palavra caía na regra de vogal. Está na
    // tabela de plurais conhecidos agora.
    expect(pluralizarMedida('porcao')).toBe('porcoes');
    // Aqui o "ao" está na locução, depois da preposição: flexiona o primeiro.
    expect(pluralizarMedida('copo de requeijao')).toBe('copos de requeijao');
  });

  it('a tela e a lista do paciente dizem a MESMA frase', () => {
    // Esta é a asserção que impede a divergência voltar: as duas pontas
    // passaram a ter uma implementação só, e o teste prova que continuam.
    for (const [q, medida] of [
      [3, 'colher de sopa'], [2, 'unidade media'], [1, 'concha'], [1.5, 'fatia'],
    ] as Array<[number, string]>) {
      expect(descreverQuantidade(q, medida)).toBe(
        descreverMedida({ quantidade: q, medida, gramasReais: 1, desvioG: 0, desvioPct: 0 }),
      );
    }
  });
});
