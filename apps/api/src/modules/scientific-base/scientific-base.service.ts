import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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
    const rows = await this.dataSource.query(`
      SELECT
        category,
        last_updated_at,
        EXTRACT(DAY FROM NOW() - last_updated_at)::int AS days_since_update,
        total_references,
        high_evidence_count
      FROM scientific_base_health
      ORDER BY last_updated_at ASC
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
      SELECT id, category, title, authors, journal, publication_year,
             evidence_level, doi, conclusions
      FROM scientific_references
      WHERE (title ILIKE $1 OR conclusions ILIKE $1 OR authors ILIKE $1)
    `;
    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    sql += ' ORDER BY evidence_level DESC, publication_year DESC LIMIT 50';

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

  async listByCategory(category: string): Promise<ScientificReference[]> {
    const rows = await this.dataSource.query(
      `SELECT id, category, title, authors, journal, publication_year,
              evidence_level, doi, conclusions
       FROM scientific_references
       WHERE category = $1
       ORDER BY evidence_level DESC, publication_year DESC`,
      [category],
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
