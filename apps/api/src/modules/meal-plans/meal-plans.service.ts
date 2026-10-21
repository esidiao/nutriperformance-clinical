import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MealPlan } from './meal-plan.entity';
import { MealPlanItem } from './meal-plan-item.entity';
import { Food } from '../foods/food.entity';
import { AuditService } from '../audit/audit.service';
import { montarListaCompras, ListaCompras } from './lista-compras';
import { montarSubstituicoes } from './substituicoes';
import { SupervisionService, PAPEL_ESTUDANTE } from '../supervision/supervision.service';
import { somarMicronutrientes, type TotalMicronutriente } from './micronutrientes';
import {
  camposDoAlimento, camposManuais, exigirAlimentoUtilizavel, exigirQuantidade,
} from './montar-item';

export const REFEICOES = [
  'cafe_manha', 'lanche_manha', 'almoco', 'lanche_tarde',
  'jantar', 'ceia', 'pre_treino', 'pos_treino',
] as const;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface TotaisNutricionais {
  kcal: number; proteinasG: number; carboidratosG: number;
  lipidiosG: number; fibrasG: number; sodioMg: number;
  /**
   * Micronutrientes com a COBERTURA junto: quantos itens do plano tinham o
   * dado. Um total somado sobre 7 de 10 alimentos parece número real e não é.
   */
  micronutrientes: Record<string, TotalMicronutriente>;
}

@Injectable()
export class MealPlansService {
  constructor(
    @InjectRepository(MealPlan) private readonly planRepo: Repository<MealPlan>,
    @InjectRepository(MealPlanItem) private readonly itemRepo: Repository<MealPlanItem>,
    @InjectRepository(Food) private readonly foodRepo: Repository<Food>,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
    private readonly supervisionService: SupervisionService,
  ) {}

  // ── Planos ────────────────────────────────────────────────────────────────

  async create(workspaceId: string, userId: string, dto: Partial<MealPlan>): Promise<MealPlan> {
    if (!dto.patientId) throw new BadRequestException('patientId é obrigatório');
    if (!dto.nome?.trim()) throw new BadRequestException('nome é obrigatório');

    const entity = this.planRepo.create({
      ...dto,
      nome: dto.nome.trim(),
      workspaceId,
      createdBy: userId,
    });
    const saved = await this.planRepo.save(entity);
    this.auditService.log({
      userId, workspaceId, action: 'CREATE', resource: 'meal_plans', resourceId: saved.id,
    });
    return saved;
  }

  async findByPatient(workspaceId: string, patientId: string): Promise<MealPlan[]> {
    return this.planRepo.find({
      where: { workspaceId, patientId, isActive: true },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  /** Plano com itens agrupados por refeição e totais calculados. */
  async findOne(workspaceId: string, id: string) {
    const plan = await this.planRepo.findOne({ where: { id, workspaceId, isActive: true } });
    if (!plan) throw new NotFoundException('Plano alimentar não encontrado');

    const itens = await this.itemRepo.find({
      where: { mealPlanId: id, workspaceId },
      order: { ordem: 'ASC', createdAt: 'ASC' },
    });

    const refeicoes = REFEICOES.map((r) => {
      const doGrupo = itens.filter((i) => i.refeicao === r);
      return { refeicao: r, itens: doGrupo, totais: this.somar(doGrupo) };
    }).filter((g) => g.itens.length > 0);

    return { ...plan, refeicoes, totais: this.somar(itens) };
  }

  /**
   * Lista de compras do plano.
   *
   * Calculada na leitura, nunca gravada: uma lista persistida envelheceria no
   * instante em que a profissional trocasse um alimento, e o paciente
   * compraria o que não vai comer.
   *
   * `dias` vem do intervalo do plano quando ele tem início e fim; sem isso, 7.
   * O teto de 90 evita que um plano com data_fim errada gere uma lista de
   * compras para um ano.
   */
  async listaCompras(workspaceId: string, id: string, diasSolicitados?: number): Promise<ListaCompras> {
    const plan = await this.planRepo.findOne({ where: { id, workspaceId, isActive: true } });
    if (!plan) throw new NotFoundException('Plano alimentar não encontrado');

    let dias = Number(diasSolicitados);
    if (!Number.isFinite(dias) || dias <= 0) {
      if (plan.dataInicio && plan.dataFim) {
        const ms = new Date(plan.dataFim).getTime() - new Date(plan.dataInicio).getTime();
        dias = Math.floor(ms / 864e5) + 1; // inclusivo: de 1 a 7 são 7 dias
      } else {
        dias = 7;
      }
    }
    if (!Number.isInteger(dias)) throw new BadRequestException('Dias deve ser um número inteiro');
    if (dias > 90) throw new BadRequestException('Máximo de 90 dias por lista');

    const itens = await this.itemRepo.find({ where: { mealPlanId: id, workspaceId } });

    // Uma consulta só para os grupos, não uma por item.
    const ids = [...new Set(itens.map((i) => i.foodId).filter(Boolean))] as string[];
    const grupoPorFoodId = new Map<string, string | null>();
    if (ids.length) {
      const foods = await this.foodRepo.find({ where: ids.map((fid) => ({ id: fid })) });
      // Sem `as any`: se a propriedade for renomeada, isto tem que quebrar no
      // compilador. Silenciado, o grupo viria undefined e TODO alimento cairia
      // na seção "Outros" — a lista continuaria sendo gerada, só que inútil, e
      // nenhum erro apareceria em lugar nenhum.
      for (const f of foods) grupoPorFoodId.set(f.id, f.grupoAlimentar ?? null);
    }

    return montarListaCompras(itens, grupoPorFoodId, dias);
  }

  /**
   * Opções de substituição para cada item do plano.
   *
   * Devolve o plano INTEIRO, não um item por vez, porque o destino da lista é
   * o paciente: ele precisa ver, para cada coisa prescrita, por quais pode
   * trocar. Uma consulta por item geraria dezenas de idas ao banco para
   * montar uma folha só.
   *
   * Os candidatos vêm de UMA consulta por grupo alimentar, não por item: um
   * plano com cinco cereais consulta o grupo "Cereais e derivados" uma vez.
   *
   * Item digitado à mão (sem `foodId`) não entra: sem vínculo com a base não
   * há composição, e sem composição não há equivalência a calcular. Ele sai
   * listado em `semVinculo` para que a tela possa dizer por que ficou de
   * fora, em vez de o alimento simplesmente sumir da folha.
   */
  async substituicoesDoPlano(workspaceId: string, id: string) {
    const plan = await this.planRepo.findOne({ where: { id, workspaceId, isActive: true } });
    if (!plan) throw new NotFoundException('Plano alimentar não encontrado');

    const itens = await this.itemRepo.find({ where: { mealPlanId: id, workspaceId } });

    const comVinculo = itens.filter((i) => i.foodId);
    const semVinculo = itens
      .filter((i) => !i.foodId)
      .map((i) => ({ itemId: i.id, nome: i.alimentoNome }));

    if (!comVinculo.length) {
      return { planoId: id, itens: [], semVinculo };
    }

    const idsOrigem = [...new Set(comVinculo.map((i) => i.foodId as string))];
    const origens = await this.foodRepo.find({ where: idsOrigem.map((fid) => ({ id: fid })) });
    const origemPorId = new Map(origens.map((f) => [f.id, f]));

    /**
     * Carrega a base ativa INTEIRA, uma vez.
     *
     * O grupo de troca é derivado da composição, não existe como coluna, e
     * portanto não dá para filtrar no banco. Consultar por grupo da TACO
     * deixaria de fora exatamente as reclassificações — o abacate não
     * estaria entre os candidatos de uma castanha, que é justamente o caso
     * que a classificação por composição existe para resolver.
     *
     * São centenas de linhas de poucas colunas, e uma consulta por
     * requisição, não por item.
     */
    const candidatos = await this.foodRepo.find({
      where: { ativo: true },
      select: [
        'id', 'nomePadronizado', 'grupoAlimentar', 'energiaKcal',
        'proteinasG', 'carboidratosG', 'lipidiosG', 'fibrasG',
      ],
    });

    const resultado = comVinculo.map((item) => {
      const origem = origemPorId.get(item.foodId as string);
      if (!origem) {
        // O alimento saiu da base depois de prescrito. Não é erro do plano, e
        // não pode derrubar a folha inteira.
        return {
          itemId: item.id,
          refeicao: item.refeicao,
          lista: {
            origem: { foodId: item.foodId, nome: item.alimentoNome, quantidadeG: num(item.quantidadeG), grupo: null },
            nutrienteReferencia: null, rotuloReferencia: null, referenciaOriginal: null,
            substituicoes: [],
            indisponivel: 'Este alimento não está mais na base de composição, então não há com que compará-lo.',
          },
        };
      }
      return {
        itemId: item.id,
        refeicao: item.refeicao,
        lista: montarSubstituicoes(origem, num(item.quantidadeG), candidatos),
      };
    });

    return { planoId: id, itens: resultado, semVinculo };
  }

  /**
   * Atualiza o plano.
   *
   * `papel` entra aqui por causa da supervisão: tirar o rascunho é o momento em
   * que o plano deixa de ser exercício e vira prescrição entregue. É o único
   * ponto onde a aprovação do supervisor precisa ser exigida — travar a edição
   * seria inútil (o estagiário precisa trabalhar) e travar depois seria tarde.
   */
  async update(
    workspaceId: string, userId: string, id: string, dto: Partial<MealPlan>, papel?: string,
  ): Promise<MealPlan> {
    const plan = await this.planRepo.findOne({ where: { id, workspaceId, isActive: true } });
    if (!plan) throw new NotFoundException('Plano alimentar não encontrado');

    const publicando = dto.isDraft === false && plan.isDraft === true;
    if (publicando && papel === PAPEL_ESTUDANTE) {
      const { liberado, motivo } = await this.supervisionService.aprovacaoValida(
        workspaceId, 'meal_plan', id, plan.updatedAt,
      );
      if (!liberado) {
        throw new BadRequestException(
          `${motivo} Um plano alimentar sob supervisão só chega ao paciente depois da `
          + 'aprovação de quem responde pelo atendimento.',
        );
      }
    }

    // Campos de identidade não são editáveis por payload
    const { id: _i, workspaceId: _w, createdBy: _c, patientId: _p, ...mutaveis } = dto as any;
    if (Object.keys(mutaveis).length === 0) return plan;

    await this.planRepo.update(id, mutaveis);
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'meal_plans',
      resourceId: id, changes: mutaveis,
    });
    return this.planRepo.findOneOrFail({ where: { id } });
  }

  /**
   * Remoção lógica. O plano é registro clínico: pode ter sido entregue ao
   * paciente, e apagar a linha destruiria o histórico do atendimento.
   */
  async remove(workspaceId: string, userId: string, id: string): Promise<{ ok: true }> {
    const plan = await this.planRepo.findOne({ where: { id, workspaceId, isActive: true } });
    if (!plan) throw new NotFoundException('Plano alimentar não encontrado');
    await this.planRepo.update(id, { isActive: false });
    this.auditService.log({
      userId, workspaceId, action: 'DELETE', resource: 'meal_plans', resourceId: id,
    });
    return { ok: true };
  }

  // ── Itens ─────────────────────────────────────────────────────────────────

  /**
   * Adiciona um alimento à refeição. Quando `foodId` é informado, os valores
   * nutricionais são copiados da base naquele instante (ver nota em
   * MealPlanItem). Sem `foodId`, aceita item manual com os valores enviados.
   */
  async addItem(
    workspaceId: string, userId: string, planId: string, dto: Partial<MealPlanItem>,
  ): Promise<MealPlanItem> {
    const plan = await this.planRepo.findOne({
      where: { id: planId, workspaceId, isActive: true },
    });
    if (!plan) throw new NotFoundException('Plano alimentar não encontrado');

    if (!dto.refeicao || !REFEICOES.includes(dto.refeicao as any)) {
      throw new BadRequestException(
        `Refeição inválida. Use uma de: ${REFEICOES.join(', ')}`,
      );
    }
    // A montagem mora em `montar-item.ts`: recordatorio de 24h usa a mesma
    // conta, e duas copias divergiriam em silencio — os dois continuariam
    // devolvendo numero, so que diferentes para o mesmo alimento.
    const quantidade = exigirQuantidade(dto.quantidadeG);

    let base: Partial<MealPlanItem>;
    if (dto.foodId) {
      // Mesmo filtro clinico das buscas: alimento bloqueado nao entra em
      // prescricao nova. Planos antigos seguem intactos porque guardam copia.
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

    const item = this.itemRepo.create({
      mealPlanId: planId,
      workspaceId,
      refeicao: dto.refeicao,
      horario: dto.horario ?? null,
      ordem: num(dto.ordem),
      foodId: dto.foodId ?? null,
      quantidadeG: quantidade,
      medidaCaseira: dto.medidaCaseira ?? null,
      substituicoes: dto.substituicoes ?? [],
      observacao: dto.observacao ?? null,
      ...base,
    });

    const saved = await this.itemRepo.save(item);
    this.auditService.log({
      userId, workspaceId, action: 'CREATE', resource: 'meal_plan_items', resourceId: saved.id,
    });
    return saved;
  }

  async removeItem(
    workspaceId: string, userId: string, planId: string, itemId: string,
  ): Promise<{ ok: true }> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, mealPlanId: planId, workspaceId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    await this.itemRepo.delete(itemId);
    this.auditService.log({
      userId, workspaceId, action: 'DELETE', resource: 'meal_plan_items', resourceId: itemId,
    });
    return { ok: true };
  }

  // ── Cálculo ───────────────────────────────────────────────────────────────

  somar(itens: MealPlanItem[]): TotaisNutricionais {
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

  /**
   * Duplica um plano com todos os itens. É o caminho normal de uso: a
   * profissional parte do plano da consulta anterior e ajusta.
   */
  async duplicate(
    workspaceId: string, userId: string, id: string, nome?: string,
  ): Promise<MealPlan> {
    const origem = await this.planRepo.findOne({ where: { id, workspaceId, isActive: true } });
    if (!origem) throw new NotFoundException('Plano alimentar não encontrado');

    const itens = await this.itemRepo.find({ where: { mealPlanId: id, workspaceId } });

    return this.dataSource.transaction(async (mgr) => {
      const { id: _i, createdAt: _c, updatedAt: _u, ...resto } = origem as any;
      const novo = await mgr.save(
        mgr.create(MealPlan, {
          ...resto,
          nome: nome?.trim() || `${origem.nome} (cópia)`,
          createdBy: userId,
          isDraft: true,
        }),
      );

      if (itens.length) {
        await mgr.save(
          itens.map((it) => {
            const { id: _ii, createdAt: _ic, updatedAt: _iu, ...ri } = it as any;
            return mgr.create(MealPlanItem, { ...ri, mealPlanId: novo.id });
          }),
        );
      }

      this.auditService.log({
        userId, workspaceId, action: 'CREATE', resource: 'meal_plans', resourceId: novo.id,
      });
      return novo;
    });
  }
  // ── Modelos ───────────────────────────────────────────────────────────────

  /**
   * Texto livre que NÃO viaja para um modelo.
   *
   * Observação de plano, orientação geral e observação de item nascem escritas
   * para uma pessoa específica — "relata azia após o jantar", "evitar por causa
   * da medicação dela". Copiadas para um modelo, reapareceriam no prontuário do
   * próximo paciente como se fossem dele. O sistema não tem como distinguir a
   * frase genérica da frase sobre alguém, e errar aqui é vazar informação
   * clínica de um paciente para outro.
   *
   * O que sobra é a estrutura: refeições, alimentos, quantidades, medidas
   * caseiras, substituições e metas — que é justamente o que se reaproveita.
   */
  private readonly TEXTO_NAO_COPIADO = ['observacoes', 'orientacoesGerais'] as const;

  /** Cria um modelo a partir de um plano existente. */
  async salvarComoModelo(
    workspaceId: string, userId: string, id: string, nome?: string,
  ): Promise<MealPlan> {
    const origem = await this.planRepo.findOne({ where: { id, workspaceId, isActive: true } });
    if (!origem) throw new NotFoundException('Plano alimentar não encontrado');
    if (origem.isTemplate) {
      throw new BadRequestException('Isto já é um modelo. Use "aplicar" para gerar um plano.');
    }

    const itens = await this.itemRepo.find({ where: { mealPlanId: id, workspaceId } });

    return this.dataSource.transaction(async (mgr) => {
      const { id: _i, createdAt: _c, updatedAt: _u, ...resto } = origem as any;

      const modelo = await mgr.save(mgr.create(MealPlan, {
        ...resto,
        // Sem paciente: um modelo não pertence a ninguém. A CHECK do banco
        // recusaria o contrário.
        patientId: null,
        isTemplate: true,
        nome: nome?.trim() || `${origem.nome} (modelo)`,
        createdBy: userId,
        isDraft: false,
        dataInicio: null,
        dataFim: null,
        observacoes: null,
        orientacoesGerais: null,
      }));

      if (itens.length) {
        await mgr.save(itens.map((it) => {
          const { id: _ii, createdAt: _ic, updatedAt: _iu, ...ri } = it as any;
          return mgr.create(MealPlanItem, {
            ...ri, mealPlanId: modelo.id, observacao: null,
          });
        }));
      }

      this.auditService.log({
        userId, workspaceId, action: 'CREATE', resource: 'meal_plans', resourceId: modelo.id,
      });
      return modelo;
    });
  }

  async listarModelos(workspaceId: string): Promise<MealPlan[]> {
    return this.planRepo.find({
      where: { workspaceId, isTemplate: true, isActive: true },
      order: { nome: 'ASC' },
      take: 200,
    });
  }

  /** Gera um plano de verdade para um paciente a partir do modelo. */
  async aplicarModelo(
    workspaceId: string, userId: string, modeloId: string, dto: any,
  ): Promise<MealPlan> {
    if (!dto?.patientId) throw new BadRequestException('patientId é obrigatório');

    const modelo = await this.planRepo.findOne({
      where: { id: modeloId, workspaceId, isTemplate: true, isActive: true },
    });
    if (!modelo) throw new NotFoundException('Modelo não encontrado');

    const itens = await this.itemRepo.find({ where: { mealPlanId: modeloId, workspaceId } });

    return this.dataSource.transaction(async (mgr) => {
      const { id: _i, createdAt: _c, updatedAt: _u, ...resto } = modelo as any;

      const plano = await mgr.save(mgr.create(MealPlan, {
        ...resto,
        patientId: dto.patientId,
        isTemplate: false,
        // Nasce como rascunho: o modelo é ponto de partida, não prescrição
        // pronta. Quem assina precisa revisar antes de entregar.
        isDraft: true,
        nome: dto.nome?.trim() || modelo.nome,
        createdBy: userId,
        dataInicio: dto.dataInicio ?? null,
        dataFim: dto.dataFim ?? null,
      }));

      if (itens.length) {
        await mgr.save(itens.map((it) => {
          const { id: _ii, createdAt: _ic, updatedAt: _iu, ...ri } = it as any;
          return mgr.create(MealPlanItem, { ...ri, mealPlanId: plano.id });
        }));
      }

      this.auditService.log({
        userId, workspaceId, action: 'CREATE', resource: 'meal_plans', resourceId: plano.id,
      });
      return plano;
    });
  }
}
