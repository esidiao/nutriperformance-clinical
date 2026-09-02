import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { clampInt, clampOffset } from '../../common/pagination.util';

export interface ScientificBaseHealth {
  category: string;
  lastUpdatedAt: Date;
  daysSinceUpdate: number;
  isStale: boolean;
  totalReferences: number;
  highEvidenceCount: number;
}

export interface ScientificReference {
  id: string;
  category: string;
  title: string;
  authors: string;
  journal: string;
  publicationYear: number;
  evidenceLevel: string;
  doi?: string;
  conclusions: string;
}

const STALE_THRESHOLD_DAYS = 90;

@Injectable()
export class ScientificBaseService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getHealth(): Promise<ScientificBaseHealth[]> {
    // `total_references` e `high_evidence_count` NAO existem em
    // scientific_base_health — a consulta antiga pedia colunas que nunca foram
    // criadas, e as quatro rotas deste modulo devolviam 500 desde sempre.
    // Descoberto na varredura de rotas contra producao.
    //
    // Sao derivados de scientific_references, que e a fonte real. Guardar
    // contagem numa tabela separada exigiria manter as duas em sincronia — e a
    // que ficasse para tras mentiria sobre o tamanho da base.
    const rows = await this.dataSource.query(`
      SELECT
        h.category,
        h.last_updated_at,
        EXTRACT(DAY FROM NOW() - h.last_updated_at)::int AS days_since_update,
        COUNT(r.id)::int AS total_references,
        COUNT(r.id) FILTER (
          WHERE r.evidence_type IN ('meta-analysis', 'systematic-review', 'rct')
        )::int AS high_evidence_count
      FROM scientific_base_health h
      LEFT JOIN scientific_references r
        ON r.category = h.category AND r.is_active = true
      GROUP BY h.category, h.last_updated_at
      ORDER BY h.last_updated_at ASC
    `);

    return rows.map((r: any) => ({
      category: r.category,
      lastUpdatedAt: r.last_updated_at,
      daysSinceUpdate: r.days_since_update,
      isStale: r.days_since_update > STALE_THRESHOLD_DAYS,
      totalReferences: r.total_references,
      highEvidenceCount: r.high_evidence_count,
    }));
  }

  async getStaleCategories(): Promise<string[]> {
    const health = await this.getHealth();
    return health.filter((h) => h.isStale).map((h) => h.category);
  }

  async searchReferences(query: string, category?: string): Promise<ScientificReference[]> {
    const params: unknown[] = [`%${query}%`];
    let sql = `
      SELECT id, category, title, authors, journal, year AS publication_year,
             evidence_type AS evidence_level, doi, summary AS conclusions
      FROM scientific_references
      WHERE is_active = true
        AND (title ILIKE $1 OR summary ILIKE $1 OR authors ILIKE $1)
    `;
    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    sql += ' ORDER BY year DESC LIMIT 50';

    const rows = await this.dataSource.query(sql, params);
    return rows.map((r: any) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      authors: r.authors,
      journal: r.journal,
      publicationYear: r.publication_year,
      evidenceLevel: r.evidence_level,
      doi: r.doi,
      conclusions: r.conclusions,
    }));
  }

  async listByCategory(category: string, limit = 200, offset = 0): Promise<ScientificReference[]> {
    // Limite defensivo: evita lista ilimitada de referências por categoria.
    // Via clampInt porque `Math.max(1, NaN)` é NaN — `?limit=abc` produzia
    // `LIMIT NaN` e um 500 do Postgres em vez de cair no padrão.
    const safeLimit = clampInt(limit, 200, 500);
    const safeOffset = clampOffset(offset);
    const rows = await this.dataSource.query(
      `SELECT id, category, title, authors, journal, year AS publication_year,
              evidence_type AS evidence_level, doi, summary AS conclusions
       FROM scientific_references
       WHERE category = $1 AND is_active = true
       ORDER BY year DESC
       LIMIT $2 OFFSET $3`,
      [category, safeLimit, safeOffset],
    );
    return rows;
  }

  async markCategoryUpdated(category: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO scientific_base_health (category, last_updated_at)
       VALUES ($1, NOW())
       ON CONFLICT (category) DO UPDATE SET last_updated_at = NOW()`,
      [category],
    );
  }
}
