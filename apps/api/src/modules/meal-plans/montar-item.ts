import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Food } from '../foods/food.entity';
import { extrairDoAlimento } from './micronutrientes';

/**
 * Monta os campos nutricionais de um item a partir do alimento e da quantidade.
 *
 * Mora aqui, fora dos serviços, porque PLANO ALIMENTAR e RECORDATÓRIO usam a
 * mesma conta. Duas cópias divergiriam, e a divergência seria invisível: os
 * dois continuariam devolvendo número, só que diferentes para o mesmo
 * alimento — e ninguém compara prescrição com recordatório campo a campo.
 *
 * A regra central: a base guarda valores por 100 g. Tudo aqui multiplica por
 * `quantidade / 100`, inclusive os micronutrientes.
 */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CamposNutricionais {
  alimentoNome: string;
  fonte: string | null;
  kcal: number;
  proteinasG: number;
  carboidratosG: number;
  lipidiosG: number;
  fibrasG: number;
  sodioMg: number;
  micronutrientes: Record<string, number>;
}

export function camposDoAlimento(
  food: Food,
  quantidadeG: number,
  nomeInformado?: string,
): CamposNutricionais {
  const f = quantidadeG / 100;
  return {
    alimentoNome: nomeInformado?.trim() || (food as any).nomePadronizado,
    fonte: (food as any).fonte ?? null,
    kcal: round2(num((food as any).energiaKcal) * f),
    proteinasG: round2(num((food as any).proteinasG) * f),
    carboidratosG: round2(num((food as any).carboidratosG) * f),
    lipidiosG: round2(num((food as any).lipidiosG) * f),
    fibrasG: round2(num((food as any).fibrasG) * f),
    sodioMg: round2(num((food as any).sodioMg) * f),
    // Só entram os nutrientes que a base realmente tem para este alimento —
    // ausente não vira zero.
    micronutrientes: extrairDoAlimento(food, quantidadeG),
  };
}

/**
 * Campos de um alimento digitado à mão.
 *
 * `micronutrientes: {}` é a afirmação certa: não há micronutriente CONHECIDO,
 * o que é diferente de zerado. O relatório de adequação trata como cobertura
 * incompleta em vez de somar zeros e produzir um total que parece real.
 */
export function camposManuais(dto: any): CamposNutricionais {
  return {
    alimentoNome: String(dto.alimentoNome).trim(),
    fonte: null,
    kcal: round2(num(dto.kcal)),
    proteinasG: round2(num(dto.proteinasG)),
    carboidratosG: round2(num(dto.carboidratosG)),
    lipidiosG: round2(num(dto.lipidiosG)),
    fibrasG: round2(num(dto.fibrasG)),
    sodioMg: round2(num(dto.sodioMg)),
    micronutrientes: {},
  };
}

/**
 * Alimento em revisão pela curadoria não entra em registro novo.
 *
 * Vale para prescrição E para recordatório: contabilizar consumo com
 * composição que a curadoria marcou como duvidosa produz um total que parece
 * medido e não é.
 */
export function exigirAlimentoUtilizavel(food: Food | null): Food {
  // NotFound e não BadRequest: alimento ausente é outra coisa que alimento
  // bloqueado, e o cliente trata diferente. A primeira versão desta função
  // unificou os dois em 400 e um teste existente pegou — refatoração não pode
  // trocar código HTTP de rota em uso.
  if (!food) throw new NotFoundException('Alimento não encontrado');
  if ((food as any).confiabilidade === 'pendente') {
    throw new BadRequestException(
      'Alimento em revisão pela curadoria — não pode ser usado',
    );
  }
  return food;
}

export function exigirQuantidade(valor: unknown): number {
  const q = num(valor);
  if (q <= 0) throw new BadRequestException('quantidadeG deve ser maior que zero');
  return q;
}
