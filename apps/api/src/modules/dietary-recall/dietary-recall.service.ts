import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DietaryRecall } from './dietary-recall.entity';
import { DietaryRecallItem } from './dietary-recall-item.entity';
import { Food } from '../foods/food.entity';
import { AuditService } from '../audit/audit.service';
import { REFEICOES } from '../meal-plans/meal-plans.service';
import { somarMicronutrientes } from '../meal-plans/micronutrientes';
import {
  camposDoAlimento, camposManuais, exigirAlimentoUtilizavel, exigirQuantidade,
} from '../meal-plans/montar-item';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export const TIPOS_DE_DIA = ['dia_util', 'fim_de_semana'] as const;

@Injectable()
export class DietaryRecallService {
  constructor(
    @InjectRepository(DietaryRecall) private readonly repo: Repository<DietaryRecall>,
    @InjectRepository(DietaryRecallItem) private readonly itemRepo: Repository<DietaryRecallItem>,
    @InjectRepository(Food) private readonly foodRepo: Repository<Food>,
    private readonly auditService: AuditService,
  ) {}

  async criar(workspaceId: string, userId: string, dto: any) {
    if (!dto?.patientId) throw new BadRequestException('patientId é obrigatório');

    const data = String(dto.dataReferencia ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      throw new BadRequestException(
        'Informe a data do dia recordado (AAAA-MM-DD). Não é a data da consulta: '
        + 'um recordatório feito na segunda costuma cobrir o domingo.',
      );
    }
    if (data > new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('A data está no futuro — não há o que recordar.');
    }

    if (dto.tipoDeDia && !TIPOS_DE_DIA.includes(dto.tipoDeDia)) {
      throw new BadRequestException(`tipoDeDia deve ser um de: ${TIPOS_DE_DIA.join(', ')}`);
    }

    const salvo = await this.repo.save(this.repo.create({
      workspaceId,
      patientId: dto.patientId,
      createdBy: userId,
      dataReferencia: data,
      tipoDeDia: dto.tipoDeDia ?? null,
      observacao: dto.observacao ? String(dto.observacao).slice(0, 2000) : null,
    }));

    this.auditService.log({
      userId, workspaceId, patientId: dto.patientId,
      action: 'CREATE', resource: 'dietary_recalls', resourceId: salvo.id,
    });
    return salvo;
  }

  async listarPorPaciente(workspaceId: string, patientId: string) {
    return this.repo.find({
      where: { workspaceId, patientId },
      order: { dataReferencia: 'DESC' },
      take: 100,
    });
  }

  /** Recordatório com itens agrupados por refeição e totais calculados. */
  async buscar(workspaceId: string, id: string) {
    const recall = await this.repo.findOne({ where: { id, workspaceId } });
    if (!recall) throw new NotFoundException('Recordatório não encontrado');

    const itens = await this.itemRepo.find({
      where: { recallId: id, workspaceId },
      order: { ordem: 'ASC', createdAt: 'ASC' },
    });

    const refeicoes = REFEICOES.map((r) => {
      const doGrupo = itens.filter((i) => i.refeicao === r);
      return { refeicao: r, itens: doGrupo, totais: this.somar(doGrupo) };
    }).filter((g) => g.itens.length > 0);

    return { ...recall, refeicoes, totais: this.somar(itens) };
  }

  async adicionarItem(workspaceId: string, userId: string, recallId: string, dto: any) {
    const recall = await this.repo.findOne({ where: { id: recallId, workspaceId } });
    if (!recall) throw new NotFoundException('Recordatório não encontrado');

    if (!dto?.refeicao || !REFEICOES.includes(dto.refeicao)) {
      throw new BadRequestException(`Refeição inválida. Use uma de: ${REFEICOES.join(', ')}`);
    }
    const quantidade = exigirQuantidade(dto.quantidadeG);

    // Mesma montagem do plano alimentar: a conta mora em `montar-item.ts` para
    // que prescrição e recordatório nunca divirjam para o mesmo alimento.
    let base: Partial<DietaryRecallItem>;
    if (dto.foodId) {
      const food = exigirAlimentoUtilizavel(
        await this.foodRepo.findOne({ where: { id: dto.foodId, ativo: true } }),
      );
      base = camposDoAlimento(food, quantidade, dto.alimentoNome);
    } else {
      if (!dto.alimentoNome?.trim()) {
        throw new BadRequestException('Informe foodId ou alimentoNome');
      }
      base = camposManuais(dto);
    }

    // `create<DietaryRecallItem>` explícito: sem o parâmetro de tipo, o
    // TypeScript resolve a sobrecarga de ARRAY e `salvo` viria
    // `DietaryRecallItem[]` — o `.id` logo abaixo sairia `undefined` e a
    // auditoria gravaria sem identificar o recurso.
    const novo = this.itemRepo.create({
      recallId,
      workspaceId,
      refeicao: dto.refeicao,
      horario: dto.horario ?? null,
      ordem: num(dto.ordem),
      foodId: dto.foodId ?? null,
      quantidadeG: quantidade,
      medidaCaseira: dto.medidaCaseira ?? null,
      observacao: dto.observacao ?? null,
      ...base,
    });
    const salvo = await this.itemRepo.save(novo);

    this.auditService.log({
      userId, workspaceId, patientId: recall.patientId,
      action: 'CREATE', resource: 'dietary_recall_items', resourceId: salvo.id,
    });
    return salvo;
  }

  async removerItem(workspaceId: string, userId: string, recallId: string, itemId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId, recallId, workspaceId } });
    if (!item) throw new NotFoundException('Item não encontrado');
    await this.itemRepo.delete(itemId);
    this.auditService.log({
      userId, workspaceId, action: 'DELETE',
      resource: 'dietary_recall_items', resourceId: itemId,
    });
    return { ok: true };
  }

  async remover(workspaceId: string, userId: string, id: string) {
    const recall = await this.repo.findOne({ where: { id, workspaceId } });
    if (!recall) throw new NotFoundException('Recordatório não encontrado');
    // Os itens caem junto pelo ON DELETE CASCADE da migração.
    await this.repo.delete(id);
    this.auditService.log({
      userId, workspaceId, patientId: recall.patientId,
      action: 'DELETE', resource: 'dietary_recalls', resourceId: id,
    });
    return { ok: true };
  }

  /**
   * Totais com os micronutrientes e a COBERTURA.
   *
   * Idêntico ao do plano alimentar, e isso é o ponto: o mesmo relatório de
   * adequação lê os dois. Num recordatório a leitura muda de sentido — não é
   * "a prescrição atinge a recomendação", é "o que a pessoa comeu atingiu" —
   * mas a conta é a mesma.
   */
  somar(itens: DietaryRecallItem[]) {
    const t = itens.reduce(
      (acc, i) => ({
        kcal: acc.kcal + num(i.kcal),
        proteinasG: acc.proteinasG + num(i.proteinasG),
        carboidratosG: acc.carboidratosG + num(i.carboidratosG),
        lipidiosG: acc.lipidiosG + num(i.lipidiosG),
        fibrasG: acc.fibrasG + num(i.fibrasG),
        sodioMg: acc.sodioMg + num(i.sodioMg),
      }),
      { kcal: 0, proteinasG: 0, carboidratosG: 0, lipidiosG: 0, fibrasG: 0, sodioMg: 0 },
    );
    return {
      kcal: round2(t.kcal),
      proteinasG: round2(t.proteinasG),
      carboidratosG: round2(t.carboidratosG),
      lipidiosG: round2(t.lipidiosG),
      fibrasG: round2(t.fibrasG),
      sodioMg: round2(t.sodioMg),
      micronutrientes: somarMicronutrientes(itens),
    };
  }
}
