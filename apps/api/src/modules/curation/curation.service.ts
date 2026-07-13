import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Food } from '../foods/food.entity';
import { AuditService } from '../audit/audit.service';
import { RagService } from '../rag/rag.service';
import { buildFoodChunkText } from '../rag/rag-chunk.util';

const CONFIABILIDADES = ['alta', 'media', 'baixa', 'pendente'];

@Injectable()
export class CurationService {
  private readonly logger = new Logger(CurationService.name);

  constructor(
    @InjectRepository(Food) private readonly foodRepo: Repository<Food>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly ragService: RagService,
  ) {}

  /** Painel de governança das bases de dados (contagens, fontes, importações). */
  async overview() {
    const [foodsByConf, foodsBySource, productsCount, ragByFonte, sources, imports] = await Promise.all([
      this.dataSource.query("SELECT confiabilidade, count(*)::int n FROM foods GROUP BY confiabilidade"),
      this.dataSource.query("SELECT fonte, count(*)::int n FROM foods GROUP BY fonte"),
      this.dataSource.query("SELECT count(*)::int n FROM industrialized_products"),
      this.dataSource.query("SELECT fonte, count(*)::int n FROM rag_chunks GROUP BY fonte"),
      this.dataSource.query("SELECT nome, versao, licenca, ultimo_import FROM data_sources ORDER BY nome"),
      this.dataSource.query(
        "SELECT fonte, linhas_inseridas, linhas_atualizadas, linhas_rejeitadas, created_at FROM import_logs ORDER BY created_at DESC LIMIT 10",
      ),
    ]);
    return {
      foods: { byConfiabilidade: foodsByConf, bySource: foodsBySource },
      products: { total: productsCount[0]?.n ?? 0 },
      rag: { byFonte: ragByFonte },
      dataSources: sources,
      recentImports: imports,
    };
  }

  /** Lista alimentos para revisão (filtra por confiabilidade). */
  async listFoods(params: { status?: string; page?: number; limit?: number; q?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 30));
    const qb = this.foodRepo.createQueryBuilder('f').orderBy('f.nome_padronizado', 'ASC')
      .skip((page - 1) * limit).take(limit);
    if (params.status && CONFIABILIDADES.includes(params.status)) {
      qb.andWhere('f.confiabilidade = :s', { s: params.status });
    }
    if (params.q) qb.andWhere('f.nome_padronizado ILIKE :q', { q: `%${params.q}%` });
    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((f) => ({
        id: f.id, nome: f.nomePadronizado, grupo: f.grupoAlimentar, fonte: f.fonte,
        confiabilidade: f.confiabilidade, ativo: f.ativo, energiaKcal: f.energiaKcal,
      })),
      total, page, limit, pages: Math.ceil(total / limit),
    };
  }

  /** Curadoria: ajusta confiabilidade/ativo de um alimento (com audit). */
  async updateFood(
    id: string,
    dto: { confiabilidade?: string; ativo?: boolean },
    userId: string,
    ip: string,
  ) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) throw new NotFoundException('Alimento não encontrado');

    const changes: Record<string, unknown> = {};
    if (dto.confiabilidade && CONFIABILIDADES.includes(dto.confiabilidade)) changes.confiabilidade = dto.confiabilidade;
    if (typeof dto.ativo === 'boolean') changes.ativo = dto.ativo;
    if (Object.keys(changes).length === 0) return { id, ...changes };

    // Estado final (combina persistido + mudanças)
    const finalAtivo = 'ativo' in changes ? (changes.ativo as boolean) : food.ativo;
    const finalConf = 'confiabilidade' in changes ? (changes.confiabilidade as string) : food.confiabilidade;
    const wasBlocked = food.ativo === false || food.confiabilidade === 'pendente';
    const nowBlocked = finalAtivo === false || finalConf === 'pendente';

    await this.foodRepo.update(id, changes);
    await this.auditService.log({
      userId, action: 'UPDATE', resource: 'foods', resourceId: id,
      ipAddress: ip, changes,
    });

    if (nowBlocked && !wasBlocked) {
      // Alimento bloqueado → remove chunk para o assistente não citá-lo
      await this.dataSource.query(
        `DELETE FROM rag_chunks WHERE fonte = $1 AND fonte_ref = $2`,
        [food.fonte, id],
      );
    } else if (!nowBlocked && wasBlocked) {
      // Alimento liberado → re-indexa em background (não bloqueia a resposta)
      const texto = buildFoodChunkText({ ...food, ...changes } as any);
      this.ragService
        .indexChunk(food.fonte, id, 'alta', texto, { nome: food.nomePadronizado })
        .catch((e: any) => this.logger.warn(
          `Falha ao re-indexar alimento liberado no RAG (id=${id}): ${e?.message ?? e}`,
        ));
    }

    return { id, ...changes };
  }
}
