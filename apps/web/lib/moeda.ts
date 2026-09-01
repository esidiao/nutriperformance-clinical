/**
 * Conversão de dinheiro digitado para centavos inteiros.
 *
 * Fica em lib/ e não na página porque um arquivo de página do Next só pode
 * exportar `default` e a configuração de rota — mas também porque é a função
 * mais arriscada da tela financeira e merece existir sozinha.
 */

/** Formata centavos inteiros como moeda brasileira. */
export const brl = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Converte o que a pessoa digitou em centavos inteiros.
 *
 * "1.234,56", "1234,56", "19.99" e "1.234" significam coisas diferentes e todas
 * aparecem na prática. A regra: o último separador é decimal se vier seguido de
 * 1 ou 2 dígitos; senão é separador de milhar. Isso resolve os quatro casos,
 * mas nenhuma regra resolve toda ambiguidade — por isso o formulário mostra o
 * valor interpretado de volta, em reais, antes de gravar. A conferência é da
 * pessoa; o palpite nunca é silencioso.
 *
 * Devolve null para entrada vazia ou sem dígito, para a tela poder desabilitar
 * o botão em vez de gravar zero.
 */
export function paraCentavos(texto: string): number | null {
  const limpo = String(texto).replace(/[^\d.,]/g, '');
  if (!/\d/.test(limpo)) return null;

  const ultimo = Math.max(limpo.lastIndexOf(','), limpo.lastIndexOf('.'));
  let inteiros = limpo;
  let decimais = '';

  if (ultimo !== -1) {
    const depois = limpo.slice(ultimo + 1);
    if (depois.length >= 1 && depois.length <= 2 && !/[.,]/.test(depois)) {
      inteiros = limpo.slice(0, ultimo);
      decimais = depois.padEnd(2, '0');
    }
  }

  const n = Number(inteiros.replace(/[.,]/g, '') + (decimais || '00'));
  return Number.isFinite(n) ? n : null;
}
