import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AIEngineService } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';
import { normalize, toVectorLiteral } from './rag-chunk.util';

const EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
const COST = 5; // tokens por consulta ao assistente

export interface RagSource {
  fonte: string;
  fonteRef: string | null;
  confiabilidade: string;
  score: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly aiEngine: AIEngineService,
    private readonly tokenService: TokenService,
  ) {}

  /** Embedding 768d normalizado (gemini-embedding-001). */
  async embed(text: string): Promise<number[]> {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) throw new ServiceUnavailableException('Serviço de IA indisponível');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`${EMBED_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`embed HTTP ${res.status}`);
      const data: any = await res.json();
      const values: number[] = data?.embedding?.values ?? [];
      if (values.length === 0) throw new Error('embedding vazio');
      return normalize(values);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Indexa (ou atualiza) um chunk no RAG: embeda o texto e faz upsert por (fonte, ref). */
  async indexChunk(fonte: string, fonteRef: string, confiabilidade: string, texto: string, metadata: Record<string, unknown> = {}) {
    const vec = await this.embed(texto);
    await this.dataSource.query(
      `INSERT INTO rag_chunks (texto, fonte, fonte_ref, confiabilidade, metadata, embedding)
       VALUES ($1,$2,$3,$4,$5,$6::vector)
       ON CONFLICT (fonte, fonte_ref) DO UPDATE SET texto=EXCLUDED.texto, embedding=EXCLUDED.embedding, confiabilidade=EXCLUDED.confiabilidade`,
      [texto, fonte, fonteRef, confiabilidade, JSON.stringify(metadata), toVectorLiteral(vec)],
    );
  }

  private async searchChunks(queryVec: number[], k = 6): Promise<Array<{
    texto: string; fonte: string; fonte_ref: string | null; confiabilidade: string; score: number;
  }>> {
    const lit = toVectorLiteral(queryVec);
    return this.dataSource.query(
      `SELECT texto, fonte, fonte_ref, confiabilidade,
              1 - (embedding <=> $1::vector) AS score
       FROM rag_chunks
       WHERE ativo = true AND embedding IS NOT NULL AND confiabilidade <> 'pendente'
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [lit, k],
    );
  }

  /** Pergunta em linguagem natural → resposta fundamentada nos chunks, com fontes. */
  async ask(params: { question: string; workspaceId: string; userId: string }) {
    const question = (params.question ?? '').trim();
    if (question.length < 3) {
      return { answer: 'Faça uma pergunta mais específica.', sources: [] as RagSource[], tokensConsumed: 0 };
    }

    // Gate de saldo ANTES de qualquer chamada paga ao Gemini (evita custo sem saldo).
    const balance = await this.tokenService.getBalance(params.workspaceId);
    if (balance.available < COST) {
      throw new BadRequestException(
        `Saldo insuficiente: ${balance.available} tokens disponíveis (necessário ${COST}).`,
      );
    }

    const qvec = await this.embed(question);
    const rows = await this.searchChunks(qvec, 6);

    if (rows.length === 0) {
      return {
        answer: 'Não há dado suficiente nas bases atuais para responder com segurança. Importe mais bases ou refine a pergunta.',
        sources: [],
        tokensConsumed: 0,
      };
    }

    const context = rows
      .map((r, i) => `(${i + 1}) [${r.fonte.toUpperCase()} · confiabilidade ${r.confiabilidade}] ${r.texto}`)
      .join('\n\n');

    const answer = await this.aiEngine.answerFromContext(question, context);

    // Cobra tokens só após resposta bem-sucedida.
    await this.tokenService.consume({
      workspaceId: params.workspaceId,
      userId: params.userId,
      operation: 'assistant_query',
      cost: COST,
      description: 'Consulta ao assistente nutricional (RAG)',
    });

    const sources: RagSource[] = rows.map((r) => ({
      fonte: r.fonte,
      fonteRef: r.fonte_ref,
      confiabilidade: r.confiabilidade,
      score: Math.round(Number(r.score) * 100) / 100,
    }));

    return { answer, sources, tokensConsumed: COST };
  }
}
