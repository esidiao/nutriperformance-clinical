import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupplementCatalog } from './supplement-catalog.entity';
import { mapDsldItem, MappedSupplement } from './dsld-mapper';

const DSLD_SEARCH = 'https://api.ods.od.nih.gov/dsld/v9/search-filter';
const UA = 'NutriPerformanceClinical/1.0 (apoio nutricional)';

function toPublic(s: SupplementCatalog) {
  return {
    id: s.id,
    dsldId: s.dsldId,
    nome: s.nome,
    marca: s.marca,
    formaFarmaceutica: s.formaFarmaceutica,
    ingredientesAtivos: s.ingredientesAtivos,
    flags: s.flags,
    advertencias: s.advertencias,
    pais: s.pais,
    fonte: s.fonte,
    confiabilidade: s.confiabilidade,
    licenca: s.licenca,
  };
}

@Injectable()
export class SupplementsCatalogService {
  private readonly logger = new Logger(SupplementsCatalogService.name);

  constructor(
    @InjectRepository(SupplementCatalog) private readonly repo: Repository<SupplementCatalog>,
  ) {}

  /** Busca no NIH DSLD (live, throttled no controller), mapeia, cacheia e retorna. */
  async search(query: string, limit = 10) {
    const q = (query ?? '').trim();
    if (q.length < 2) return [];
    const size = Math.min(20, Math.max(1, limit));

    const hits = await this.fetchDsld(q, size);
    if (hits.length === 0) {
      // Fallback: o que já estiver em cache local
      return (await this.repo
        .createQueryBuilder('s')
        .where('s.nome ILIKE :like OR s.marca ILIKE :like', { like: `%${q}%` })
        .take(size)
        .getMany()).map(toPublic);
    }

    const mapped = hits.map(mapDsldItem).filter((m) => m.dsld_id);
    await this.cacheMany(mapped);
    return mapped.map((m) => ({
      dsldId: m.dsld_id,
      nome: m.nome,
      marca: m.marca,
      formaFarmaceutica: m.forma_farmaceutica,
      ingredientesAtivos: m.ingredientes_ativos,
      flags: m.flags,
      advertencias: m.advertencias,
      pais: 'EUA',
      fonte: 'dsld',
      confiabilidade: 'alta',
      licenca: 'Domínio público (NIH DSLD)',
    }));
  }

  private async fetchDsld(q: string, size: number): Promise<any[]> {
    try {
      const url = `${DSLD_SEARCH}?q=${encodeURIComponent(q)}&size=${size}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } })
        .finally(() => clearTimeout(timer));
      if (!res.ok) return [];
      const data: any = await res.json();
      return Array.isArray(data?.hits) ? data.hits : [];
    } catch (err: any) {
      this.logger.warn(`Falha ao consultar NIH DSLD: ${err?.message}`);
      return [];
    }
  }

  private async cacheMany(items: MappedSupplement[]): Promise<void> {
    for (const m of items) {
      try {
        await this.repo
          .createQueryBuilder()
          .insert()
          .into(SupplementCatalog)
          .values({
            dsldId: m.dsld_id, nome: m.nome, marca: m.marca,
            formaFarmaceutica: m.forma_farmaceutica, ingredientesAtivos: m.ingredientes_ativos,
            flags: m.flags, advertencias: m.advertencias,
          })
          .orUpdate(
            ['nome', 'marca', 'forma_farmaceutica', 'ingredientes_ativos', 'flags', 'advertencias', 'data_atualizacao'],
            ['dsld_id'],
          )
          .execute();
      } catch (err: any) {
        this.logger.warn(`Falha ao cachear suplemento ${m.dsld_id}: ${err?.message}`);
      }
    }
  }
}
