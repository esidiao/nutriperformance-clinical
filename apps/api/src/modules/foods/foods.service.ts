import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Food } from './food.entity';
import { mapUsdaFood } from './usda-mapper';
import { RagService } from '../rag/rag.service';
import { buildFoodChunkText } from '../rag/rag-chunk.util';

const USDA_SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// DTO público — expõe apenas o necessário ao cliente, sempre com proveniência.
function toPublic(f: Food) {
  return {
    id: f.id,
    nome: f.nomePadronizado,
    nomesPopulares: f.nomesPopulares,
    grupoAlimentar: f.grupoAlimentar,
    novaClassificacao: f.novaClassificacao,
    porcaoPadraoG: Number(f.porcaoPadraoG),
    energiaKcal: f.energiaKcal != null ? Number(f.energiaKcal) : null,
    carboidratosG: f.carboidratosG != null ? Number(f.carboidratosG) : null,
    proteinasG: f.proteinasG != null ? Number(f.proteinasG) : null,
    lipidiosG: f.lipidiosG != null ? Number(f.lipidiosG) : null,
    gorduraSaturadaG: f.gorduraSaturadaG != null ? Number(f.gorduraSaturadaG) : null,
    gorduraTransG: f.gorduraTransG != null ? Number(f.gorduraTransG) : null,
    fibrasG: f.fibrasG != null ? Number(f.fibrasG) : null,
    sodioMg: f.sodioMg != null ? Number(f.sodioMg) : null,
    acucaresG: f.acucaresG != null ? Number(f.acucaresG) : null,
    calcioMg: f.calcioMg != null ? Number(f.calcioMg) : null,
    ferroMg: f.ferroMg != null ? Number(f.ferroMg) : null,
    potassioMg: f.potassioMg != null ? Number(f.potassioMg) : null,
    magnesioMg: f.magnesioMg != null ? Number(f.magnesioMg) : null,
    zincoMg: f.zincoMg != null ? Number(f.zincoMg) : null,
    indiceGlicemico: f.indiceGlicemico != null ? Number(f.indiceGlicemico) : null,
    alergenos: f.alergenos,
    vitaminas: f.vitaminas,
    observacoesClinicas: f.observacoesClinicas,
    // Proveniência sempre presente (modelo da evidence_base)
    fonte: f.fonte,
    fonteVersao: f.fonteVersao,
    confiabilidade: f.confiabilidade,
  };
}

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name);

  constructor(
    @InjectRepository(Food) private readonly repo: Repository<Food>,
    private readonly config: ConfigService,
    private readonly ragService: RagService,
  ) {}

  /**
   * Importa sob demanda alimentos do USDA FoodData Central (domínio público).
   * Usa USDA_API_KEY do ambiente ou DEMO_KEY (baixo volume). Cacheia em `foods`
   * (fonte='usda') — passam a aparecer no autocomplete/comparador — e indexa no RAG.
   */
  async searchUsda(query: string, limit = 10) {
    const q = (query ?? '').trim();
    if (q.length < 2) return [];
    const key = this.config.get<string>('USDA_API_KEY') || 'DEMO_KEY';
    const size = Math.min(20, Math.max(1, limit));

    let foods: any[] = [];
    try {
      const url = `${USDA_SEARCH}?api_key=${key}&query=${encodeURIComponent(q)}&pageSize=${size}&dataType=${encodeURIComponent('SR Legacy,Foundation')}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) { this.logger.warn(`USDA HTTP ${res.status}`); return []; }
      const data: any = await res.json();
      foods = Array.isArray(data?.foods) ? data.foods : [];
    } catch (err: any) {
      this.logger.warn(`Falha ao consultar USDA: ${err?.message}`);
      return [];
    }

    const mapped = foods.map(mapUsdaFood).filter((m) => m.nome_padronizado && m.fonte_id_externo);
    const savedIds: string[] = [];
    for (const m of mapped) {
      await this.repo.upsert(
        {
          nomePadronizado: m.nome_padronizado, grupoAlimentar: m.grupo_alimentar,
          energiaKcal: m.energia_kcal as any, proteinasG: m.proteinas_g as any, carboidratosG: m.carboidratos_g as any,
          lipidiosG: m.lipidios_g as any, gorduraSaturadaG: m.gordura_saturada_g as any, fibrasG: m.fibras_g as any,
          acucaresG: m.acucares_g as any, sodioMg: m.sodio_mg as any, calcioMg: m.calcio_mg as any, ferroMg: m.ferro_mg as any,
          potassioMg: m.potassio_mg as any, magnesioMg: m.magnesio_mg as any, zincoMg: m.zinco_mg as any,
          vitaminas: m.vitaminas, fonte: 'usda', fonteIdExterno: m.fonte_id_externo,
          fonteVersao: 'FoodData Central', confiabilidade: 'alta', licenca: 'Domínio público (USDA, CC0)',
        } as any,
        { conflictPaths: ['fonte', 'fonteIdExterno'] },
      );
      savedIds.push(m.fonte_id_externo!);
    }

    const rows = await this.repo.find({ where: { fonte: 'usda', fonteIdExterno: In(savedIds) } });
    // Indexa no RAG (fire-and-forget) — não bloqueia a resposta
    for (const f of rows) {
      this.ragService
        .indexChunk('usda', f.id, 'alta', buildFoodChunkText(f as any), { nome: f.nomePadronizado })
        .catch((e: any) => this.logger.warn(`Falha ao indexar alimento USDA no RAG (${f.id}): ${e?.message}`));
    }
    return rows.map(toPublic);
  }

  /**
   * Busca por nome padronizado ou nomes populares.
   * Bloqueio clínico: itens 'pendente' ou inativos NÃO entram na busca (uso clínico
   * exige fonte confiável). Curadoria libera ao promover confiabilidade.
   */
  async search(query: string, limit = 20) {
    const q = (query ?? '').trim();
    if (q.length < 2) return [];
    const take = Math.min(50, Math.max(1, limit));

    const rows = await this.repo
      .createQueryBuilder('f')
      .where('f.ativo = true')
      .andWhere("f.confiabilidade <> 'pendente'")
      .andWhere(
        '(f.nome_padronizado ILIKE :like OR EXISTS (SELECT 1 FROM unnest(f.nomes_populares) np WHERE np ILIKE :like))',
        { like: `%${q}%` },
      )
      .orderBy(
        // prioriza prefixo exato
        "CASE WHEN f.nome_padronizado ILIKE :prefix THEN 0 ELSE 1 END",
        'ASC',
      )
      .addOrderBy('f.nome_padronizado', 'ASC')
      .setParameter('prefix', `${q}%`)
      .take(take)
      .getMany();

    return rows.map(toPublic);
  }

  async findById(id: string) {
    const food = await this.repo.findOne({ where: { id, ativo: true } });
    if (!food) throw new NotFoundException('Alimento não encontrado');
    if (food.confiabilidade === 'pendente') throw new NotFoundException('Alimento não disponível');
    return toPublic(food);
  }

  /** Comparação lado a lado de 2 a 4 alimentos (valores por porção padrão / 100g). */
  async compare(ids: string[]) {
    const clean = (ids ?? []).filter(Boolean).slice(0, 4);
    if (clean.length < 2) return [];
    // Bloqueio clínico: itens 'pendente' (curadoria) não entram na comparação.
    const rows = (await this.repo.find({ where: { id: In(clean) } }))
      .filter((r) => r.confiabilidade !== 'pendente' && r.ativo !== false);
    // preserva a ordem solicitada
    const byId = new Map(rows.map((r) => [r.id, r]));
    return clean.map((id) => byId.get(id)).filter(Boolean).map((f) => toPublic(f!));
  }
}
