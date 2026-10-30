import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ContasAtivasService } from './contas-ativas.service';

/**
 * O que estes testes seguram, e por que cada um existe:
 *
 * `users.is_active` e `workspaces.is_active` ficaram meses sendo escritos pelo
 * painel administrativo e lidos por ninguem. Nada falhava — e justamente por
 * isso ninguem viu. Suite verde com a conferencia ausente foi o estado normal
 * do projeto ate 30/10/2026.
 *
 * Por isso cada regra tem o caso ESPELHADO: o que nega e o que deixa passar.
 * Teste que so verifica a negacao passaria num servico que nega tudo, e um
 * servico que nega tudo e tao inutil quanto um que nega nada.
 */
describe('ContasAtivasService', () => {
  function comResposta(
    linhas: Array<Record<string, unknown>> | Error,
  ): { servico: ContasAtivasService; query: jest.Mock } {
    const query = jest.fn(() =>
      linhas instanceof Error ? Promise.reject(linhas) : Promise.resolve(linhas),
    );
    const db = { query } as unknown as DataSource;
    return { servico: new ContasAtivasService(db), query };
  }

  const SUB = '11111111-1111-1111-1111-111111111111';
  const WS = '22222222-2222-2222-2222-222222222222';

  it('deixa passar conta ativa em workspace ativo', async () => {
    const { servico } = comResposta([{ usuario_ativo: true, workspace_ativo: true }]);
    await expect(servico.motivoParaNegar(SUB, WS)).resolves.toBeNull();
  });

  it('NEGA quando users.is_active e false', async () => {
    // O caso da pratica: profissional desligada, administrador desativa a
    // conta, painel mostra "inativo" — e ela continuava entrando.
    const { servico } = comResposta([{ usuario_ativo: false, workspace_ativo: true }]);
    await expect(servico.motivoParaNegar(SUB, WS)).resolves.toMatch(/desativada/i);
  });

  it('NEGA quando workspaces.is_active e false', async () => {
    // `PATCH /admin/workspaces/:id/suspend` gravava isto e nao suspendia nada.
    const { servico } = comResposta([{ usuario_ativo: true, workspace_ativo: false }]);
    await expect(servico.motivoParaNegar(SUB, WS)).resolves.toMatch(/suspenso/i);
  });

  it('NEGA quando nao existe linha em users para o sub do token', async () => {
    // Token valido de conta que o sistema nao conhece. Falha fechado: um token
    // prova quem assinou, nao que a conta exista.
    const { servico } = comResposta([]);
    await expect(servico.motivoParaNegar(SUB, WS)).resolves.toMatch(/sem perfil/i);
  });

  it('NEGA quando o workspace do token nao existe (LEFT JOIN sem par)', async () => {
    const { servico } = comResposta([{ usuario_ativo: true, workspace_ativo: null }]);
    await expect(servico.motivoParaNegar(SUB, WS)).resolves.toMatch(/nao existe mais/i);
  });

  it('NEGA quando a consulta ao banco falha', async () => {
    // Deixar passar aqui transformaria indisponibilidade do banco em "todo
    // mundo entra sem conferencia".
    const { servico } = comResposta(new Error('connection terminated'));
    // O servico registra o erro de proposito — em producao esse log e o aviso
    // de que o banco caiu. Aqui so evitamos sujar a saida da suite.
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await expect(servico.motivoParaNegar(SUB, WS)).resolves.toMatch(/nao foi possivel confirmar/i);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('confere o workspace DO TOKEN, nao o da linha de users', async () => {
    // Se os dois divergirem, o que importa e o do token: e ele que os servicos
    // usam para filtrar, logo e ele que a requisicao vai acessar.
    const { servico, query } = comResposta([{ usuario_ativo: true, workspace_ativo: true }]);
    await servico.motivoParaNegar(SUB, WS);
    expect(query.mock.calls[0][1]).toEqual([SUB, WS]);
  });

  describe('cache', () => {
    it('nao reconsulta o banco dentro da janela', async () => {
      const { servico, query } = comResposta([{ usuario_ativo: true, workspace_ativo: true }]);
      await servico.motivoParaNegar(SUB, WS);
      await servico.motivoParaNegar(SUB, WS);
      await servico.motivoParaNegar(SUB, WS);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('guarda por conta E workspace, nao so por conta', async () => {
      // Uma chave so pelo `sub` daria o veredito de um workspace a outro.
      const { servico, query } = comResposta([{ usuario_ativo: true, workspace_ativo: true }]);
      await servico.motivoParaNegar(SUB, WS);
      await servico.motivoParaNegar(SUB, 'outro-workspace');
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('reconsulta depois que a janela expira', async () => {
      const { servico, query } = comResposta([{ usuario_ativo: true, workspace_ativo: true }]);
      await servico.motivoParaNegar(SUB, WS);

      const real = Date.now;
      Date.now = () => real() + 31_000;
      try {
        await servico.motivoParaNegar(SUB, WS);
      } finally {
        Date.now = real;
      }
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('limparCache() faz a proxima chamada consultar de novo', async () => {
      // E isto que faz a suspensao pelo painel valer na hora.
      const { servico, query } = comResposta([{ usuario_ativo: true, workspace_ativo: true }]);
      await servico.motivoParaNegar(SUB, WS);
      servico.limparCache();
      await servico.motivoParaNegar(SUB, WS);
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('a janela em cache tambem vale para a NEGACAO, sem travar a reativacao', async () => {
      const { servico, query } = comResposta([{ usuario_ativo: false, workspace_ativo: true }]);
      await servico.motivoParaNegar(SUB, WS);
      await servico.motivoParaNegar(SUB, WS);
      expect(query).toHaveBeenCalledTimes(1);
      servico.limparCache();
      await servico.motivoParaNegar(SUB, WS);
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('a consulta', () => {
    it('le as duas colunas is_active, nao so a do usuario', async () => {
      const { servico, query } = comResposta([{ usuario_ativo: true, workspace_ativo: true }]);
      await servico.motivoParaNegar(SUB, WS);
      const sql: string = query.mock.calls[0][0];
      expect(sql).toMatch(/u\.is_active/);
      expect(sql).toMatch(/w\.is_active/);
    });
  });
});
