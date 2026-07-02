import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { RagService } from './rag.service';
import { AIEngineService } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';

describe('RagService.ask', () => {
  let service: RagService;
  const aiEngine = { answerFromContext: jest.fn().mockResolvedValue('Resposta [TACO].') };
  const tokenService = { getBalance: jest.fn(), consume: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('key') } },
        { provide: DataSource, useValue: { query: jest.fn() } },
        { provide: AIEngineService, useValue: aiEngine },
        { provide: TokenService, useValue: tokenService },
      ],
    }).compile();
    service = module.get(RagService);
  });

  it('rejeita pergunta muito curta sem gastar nada', async () => {
    const r = await service.ask({ question: 'oi', workspaceId: 'ws', userId: 'u' });
    expect(r.tokensConsumed).toBe(0);
    expect(tokenService.getBalance).not.toHaveBeenCalled();
  });

  it('bloqueia ANTES do Gemini quando saldo é insuficiente (sem custo)', async () => {
    tokenService.getBalance.mockResolvedValueOnce({ balance: 2, reserved: 0, available: 2 });
    const embedSpy = jest.spyOn(service as any, 'embed');
    await expect(service.ask({ question: 'alimentos ricos em ferro', workspaceId: 'ws', userId: 'u' }))
      .rejects.toThrow(BadRequestException);
    expect(embedSpy).not.toHaveBeenCalled();
    expect(tokenService.consume).not.toHaveBeenCalled();
  });

  it('responde "sem dado" e NÃO consome quando não há contexto', async () => {
    tokenService.getBalance.mockResolvedValueOnce({ balance: 100, reserved: 0, available: 100 });
    jest.spyOn(service as any, 'embed').mockResolvedValue([0.1, 0.2]);
    jest.spyOn(service as any, 'searchChunks').mockResolvedValue([]);
    const r = await service.ask({ question: 'pergunta sem base', workspaceId: 'ws', userId: 'u' });
    expect(r.sources).toEqual([]);
    expect(r.tokensConsumed).toBe(0);
    expect(tokenService.consume).not.toHaveBeenCalled();
  });

  it('fluxo feliz: responde com fontes e consome 5 tokens', async () => {
    tokenService.getBalance.mockResolvedValueOnce({ balance: 100, reserved: 0, available: 100 });
    jest.spyOn(service as any, 'embed').mockResolvedValue([0.1, 0.2]);
    jest.spyOn(service as any, 'searchChunks').mockResolvedValue([
      { texto: 'Feijão ferro 1.3mg', fonte: 'taco', fonte_ref: 'f1', confiabilidade: 'alta', score: 0.8 },
    ]);
    const r = await service.ask({ question: 'alimentos ricos em ferro', workspaceId: 'ws', userId: 'u' });
    expect(r.answer).toContain('TACO');
    expect(r.sources[0].fonte).toBe('taco');
    expect(r.tokensConsumed).toBe(5);
    expect(tokenService.consume).toHaveBeenCalledWith(expect.objectContaining({ operation: 'assistant_query', cost: 5 }));
  });
});
