import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { BillingService } from './billing.service';
import { TokenService } from '../tokens/token.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'test-secret-32byteslong-padding!!';

function buildSignature(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTokenService = {
  credit: jest.fn().mockResolvedValue({ id: 'tx-1', amount: 100 }),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'MP_WEBHOOK_SECRET') return WEBHOOK_SECRET;
    if (key === 'MP_ACCESS_TOKEN') return 'TEST_ACCESS_TOKEN';
    return undefined;
  }),
};

// MercadoPago Payment.get mock
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Preference: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
  Payment: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue({
      id: '99999',
      status: 'approved',
      metadata: { workspace_id: 'ws-1', tokens: '100', package_id: 'pkg-starter' },
    }),
  })),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BillingService — handleWebhook', () => {
  let service: BillingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  // ── Cenário 1: webhook com assinatura válida ────────────────────────────────
  it('deve processar pagamento aprovado com assinatura válida', async () => {
    const dataId = '99999';
    const requestId = 'req-abc-123';
    const ts = '1718000000';
    const xSignature = buildSignature(dataId, requestId, ts);

    const body = { type: 'payment', data: { id: dataId } };

    await expect(
      service.handleWebhook(body, xSignature, requestId),
    ).resolves.not.toThrow();

    expect(mockTokenService.credit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        amount: 100,
        operation: 'purchase',
        paymentId: '99999',
      }),
    );
  });

  // ── Cenário 2: sem MP_WEBHOOK_SECRET configurado ───────────────────────────
  it('deve rejeitar webhook quando MP_WEBHOOK_SECRET não está configurado', async () => {
    const noSecretConfig = {
      get: jest.fn((key: string) => {
        if (key === 'MP_WEBHOOK_SECRET') return undefined;
        if (key === 'MP_ACCESS_TOKEN') return 'TEST_ACCESS_TOKEN';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: ConfigService, useValue: noSecretConfig },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    const svc = module.get<BillingService>(BillingService);
    const body = { type: 'payment', data: { id: '111' } };

    await expect(
      svc.handleWebhook(body, 'ts=1,v1=abc', 'req-1'),
    ).rejects.toThrow('Configuração de webhook ausente');

    expect(mockTokenService.credit).not.toHaveBeenCalled();
  });

  // ── Cenário 3: assinatura HMAC inválida ────────────────────────────────────
  it('deve rejeitar webhook com assinatura HMAC inválida', async () => {
    const body = { type: 'payment', data: { id: '12345' } };
    const badSignature = 'ts=1718000000,v1=invalidsignaturehexvalue0000000000';

    await expect(
      service.handleWebhook(body, badSignature, 'req-xyz'),
    ).rejects.toThrow('Webhook inválido');

    expect(mockTokenService.credit).not.toHaveBeenCalled();
  });

  // ── Cenário 4: cabeçalhos x-signature ou x-request-id ausentes ────────────
  it('deve rejeitar webhook sem cabeçalhos de assinatura', async () => {
    const body = { type: 'payment', data: { id: '12345' } };

    await expect(
      service.handleWebhook(body, undefined, undefined),
    ).rejects.toThrow('Assinatura obrigatória');

    expect(mockTokenService.credit).not.toHaveBeenCalled();
  });

  // ── Cenário 5: assinatura malformada (sem ts= ou v1=) ─────────────────────
  it('deve rejeitar assinatura malformada sem campos ts/v1', async () => {
    const body = { type: 'payment', data: { id: '12345' } };
    const malformed = 'somethingwrong';

    await expect(
      service.handleWebhook(body, malformed, 'req-1'),
    ).rejects.toThrow('Assinatura malformada');

    expect(mockTokenService.credit).not.toHaveBeenCalled();
  });

  // ── Cenário 6: evento que não é payment (deve ignorar silenciosamente) ────
  it('deve ignorar eventos que não são de pagamento', async () => {
    const dataId = 'evt-1';
    const requestId = 'req-evt';
    const ts = '1718000000';
    const xSignature = buildSignature(dataId, requestId, ts);

    const body = { type: 'subscription.updated', data: { id: dataId } };

    await expect(
      service.handleWebhook(body, xSignature, requestId),
    ).resolves.not.toThrow();

    expect(mockTokenService.credit).not.toHaveBeenCalled();
  });
});

// ── TokenService — idempotência de credit() ──────────────────────────────────

describe('TokenService.credit — idempotência por paymentId', () => {
  it('deve retornar transação existente sem debitar novamente se paymentId repetido', async () => {
    const existingTx = { id: 'tx-existing', amount: 100, paymentId: 'pay-dup' };
    const txRepo = { findOne: jest.fn().mockResolvedValue(existingTx) };
    const workspaceRepo = { createQueryBuilder: jest.fn() };
    const costRepo = {};
    const dataSource = { transaction: jest.fn() };

    // Importar dinamicamente para injetar mock
    const { TokenService: TS } = await import('../tokens/token.service');
    const svc = new (TS as any)(workspaceRepo, txRepo, costRepo, dataSource);

    const result = await svc.credit({
      workspaceId: 'ws-1',
      operation: 'purchase',
      amount: 100,
      description: 'Pagamento MP',
      paymentId: 'pay-dup',
    });

    expect(result).toEqual(existingTx);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(txRepo.findOne).toHaveBeenCalledWith({ where: { paymentId: 'pay-dup' } });
  });
});
