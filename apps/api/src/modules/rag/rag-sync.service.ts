import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { RagService } from './rag.service';
import { buildFoodChunkText } from './rag-chunk.util';

/**
 * Sincronização periódica do RAG: indexa incrementalmente alimentos que ainda não
 * têm chunk (ex.: após novas importações). Incremental + limitado, semanal — barato.
 */
@Injectable()
export class RagSyncService {
  private readonly logger = new Logger(RagSyncService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly ragService: RagService,
  ) {}

  // Chave do advisory lock (evita execução duplicada se houver >1 instância da API).
  private static readonly LOCK_KEY = 778921;

  @Cron(CronExpression.EVERY_WEEK)
  async syncMissingFoods(limit = 100) {
    if (this.running) return;
    this.running = true;

    // Lock distribuído no Postgres: só uma instância roda o sync por vez.
    const lockRes = await this.dataSource.query('SELECT pg_try_advisory_lock($1) AS locked', [RagSyncService.LOCK_KEY]);
    if (!lockRes?.[0]?.locked) { this.running = false; return; }

    try {
      const foods = await this.dataSource.query(
        `SELECT f.id, f.nome_padronizado, f.grupo_alimentar, f.porcao_padrao_g, f.energia_kcal, f.proteinas_g,
                f.carboidratos_g, f.lipidios_g, f.fibras_g, f.sodio_mg, f.ferro_mg, f.calcio_mg, f.potassio_mg,
                f.magnesio_mg, f.zinco_mg, f.fonte
         FROM foods f
         LEFT JOIN rag_chunks r ON r.fonte = f.fonte AND r.fonte_ref = f.id::text
         WHERE r.id IS NULL AND f.ativo = true AND f.confiabilidade <> 'pendente'
         LIMIT $1`,
        [limit],
      );
      if (foods.length === 0) { this.logger.debug('RAG sync: nada a indexar.'); return; }
      this.logger.log(`RAG sync: indexando ${foods.length} alimento(s) sem chunk...`);
      let ok = 0;
      for (const f of foods) {
        const texto = buildFoodChunkText({
          nomePadronizado: f.nome_padronizado, grupoAlimentar: f.grupo_alimentar, porcaoPadraoG: f.porcao_padrao_g,
          energiaKcal: f.energia_kcal, proteinasG: f.proteinas_g, carboidratosG: f.carboidratos_g, lipidiosG: f.lipidios_g,
          fibrasG: f.fibras_g, sodioMg: f.sodio_mg, ferroMg: f.ferro_mg, calcioMg: f.calcio_mg, potassioMg: f.potassio_mg,
          magnesioMg: f.magnesio_mg, zincoMg: f.zinco_mg, fonte: f.fonte,
        });
        try { await this.ragService.indexChunk(f.fonte, f.id, 'alta', texto, { nome: f.nome_padronizado }); ok++; }
        catch (e: any) { this.logger.warn(`RAG sync falhou para ${f.id}: ${e?.message}`); }
        await new Promise((r) => setTimeout(r, 250));
      }
      this.logger.log(`RAG sync concluído: ${ok}/${foods.length} indexados.`);
    } finally {
      // Libera o lock para que a próxima execução (ou outra instância) possa adquiri-lo.
      await this.dataSource.query('SELECT pg_advisory_unlock($1)', [RagSyncService.LOCK_KEY]).catch(() => undefined);
      this.running = false;
    }
  }
}
