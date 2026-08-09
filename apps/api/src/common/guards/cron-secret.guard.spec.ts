import { UnauthorizedException } from '@nestjs/common';
import { CronSecretGuard } from './cron-secret.guard';

function ctx(headers: Record<string, unknown> = {}) {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as any;
}

describe('CronSecretGuard', () => {
  let guard: CronSecretGuard;
  const ORIGINAL = process.env.CRON_SECRET;

  beforeEach(() => {
    guard = new CronSecretGuard();
    process.env.CRON_SECRET = 'segredo-correto-abc123';
  });

  afterAll(() => {
    if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL;
  });

  it('libera quando o header confere', () => {
    expect(guard.canActivate(ctx({ 'x-cron-secret': 'segredo-correto-abc123' }))).toBe(true);
  });

  it('falha FECHADO quando CRON_SECRET não está no ambiente', () => {
    delete process.env.CRON_SECRET;
    // Mesmo mandando um header, a rota não pode abrir: sem segredo configurado
    // ela seria pública, já que @Public() dispensa o JwtAuthGuard.
    expect(() => guard.canActivate(ctx({ 'x-cron-secret': 'qualquer-coisa' })))
      .toThrow(UnauthorizedException);
  });

  it('recusa quando CRON_SECRET está vazio', () => {
    process.env.CRON_SECRET = '';
    expect(() => guard.canActivate(ctx({ 'x-cron-secret': '' }))).toThrow(UnauthorizedException);
  });

  it('recusa header ausente', () => {
    expect(() => guard.canActivate(ctx({}))).toThrow(UnauthorizedException);
  });

  it('recusa segredo errado do mesmo tamanho', () => {
    expect(() => guard.canActivate(ctx({ 'x-cron-secret': 'segredo-correto-abc124' })))
      .toThrow(UnauthorizedException);
  });

  it('recusa prefixo correto mas truncado (tamanhos diferentes)', () => {
    expect(() => guard.canActivate(ctx({ 'x-cron-secret': 'segredo-correto' })))
      .toThrow(UnauthorizedException);
  });

  it('recusa header repetido, que o Node entrega como array', () => {
    expect(() => guard.canActivate(ctx({ 'x-cron-secret': ['segredo-correto-abc123'] })))
      .toThrow(UnauthorizedException);
  });

  it('não confunde string vazia com ausência de header', () => {
    expect(() => guard.canActivate(ctx({ 'x-cron-secret': '' }))).toThrow(UnauthorizedException);
  });
});
