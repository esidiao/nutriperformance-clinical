import { HealthController } from './health.controller';

/**
 * O /health e o unico jeito barato de saber QUAL codigo esta no ar.
 *
 * Este projeto ja teve tres diagnosticos errados de deploy — readyState, CSS e,
 * o ultimo, um pedido de deploy para um commit que nunca tinha sido enviado ao
 * origin. Todos custaram rodadas inteiras de investigacao no lugar errado.
 */
describe('HealthController', () => {
  const comBanco = (ok: boolean) =>
    new HealthController({ query: ok ? async () => [1] : async () => { throw new Error('x'); } } as any);

  const original = process.env.RENDER_GIT_COMMIT;
  afterEach(() => {
    if (original === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = original;
  });

  it('expoe o commit publicado, encurtado', async () => {
    process.env.RENDER_GIT_COMMIT = '8ed23aa1c0ffee0000000000000000000000abcd';
    expect((await comBanco(true).check()).commit).toBe('8ed23aa');
  });

  it('fora do Render, diz que nao sabe em vez de inventar', async () => {
    // 'desconhecido' e uma resposta util; um campo ausente ou um '' seriam
    // lidos como "bateu com o esperado" por qualquer comparacao descuidada.
    delete process.env.RENDER_GIT_COMMIT;
    expect((await comBanco(true).check()).commit).toBe('desconhecido');
  });

  it('banco fora nao derruba a rota — ela precisa responder para diagnosticar', async () => {
    const r = await comBanco(false).check();
    expect(r.status).toBe('degraded');
    expect(r.database).toBe('disconnected');
  });
});
