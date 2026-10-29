import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';

/**
 * A identidade de quem assina o documento clínico.
 *
 * O teste existe porque o defeito que ele previne é invisível no resultado: o
 * PDF sai bonito, assinado, com um CRN — só que o CRN é de outra pessoa.
 * Nenhuma tela quebra, nenhum log acusa.
 */
describe('UsersController.me', () => {
  const linha = {
    id: 'u1', fullName: 'Claudia Santos', email: 'c@x.com', role: 'nutritionist',
    councilType: 'CRN', councilNumber: '12345', councilState: 'GO',
  };

  const auditoria = { log: jest.fn() };
  function controlador(achar: any, repo: any = {}) {
    return new UsersController(
      { findOne: jest.fn().mockResolvedValue(achar), save: jest.fn(), ...repo } as any,
      auditoria as any,
    );
  }
  beforeEach(() => auditoria.log.mockClear());

  const req = { user: { sub: 'u1', workspaceId: 'ws1' } };

  it('devolve nome e os campos crus do conselho', async () => {
    const r = await controlador(linha).me(req);
    expect(r.nome).toBe('Claudia Santos');
    expect(r.conselho).toBe('CRN');
    expect(r.conselhoNumero).toBe('12345');
    expect(r.conselhoUf).toBe('GO');
  });

  it('busca pelo sub do token E pelo workspace', async () => {
    // Sem o workspace, um id vazado de outra clínica devolveria a identidade
    // de lá. O filtro duplo é barato e fecha isso.
    const repo = { findOne: jest.fn().mockResolvedValue(linha), save: jest.fn() };
    await new UsersController(repo as any, auditoria as any).me(req);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'u1', workspaceId: 'ws1' },
    });
  });

  it('sem perfil, RECUSA em vez de devolver esqueleto', async () => {
    // Devolver `{ nome: null }` faria a tela assinar com campo vazio, que é
    // justamente o que não pode acontecer num documento clínico.
    await expect(controlador(null).me(req)).rejects.toThrow(NotFoundException);
    await expect(controlador(null).me(req)).rejects.toThrow(/registro de conselho/);
  });

  it('NÃO compõe o registro no servidor', async () => {
    // Concatenar tipo + número dava "CFN CRN-3 12345". A composição mora em
    // `web/lib/registro-profissional.ts`, onde o PDF e as telas a usam — uma
    // implementação só.
    const r: any = await controlador(linha).me(req);
    expect(r.registro).toBeUndefined();
  });

  it('não devolve campo que não foi pedido', async () => {
    // A rota é sobre QUEM ASSINA. Crescer aqui é publicar dado de conta para
    // o front sem decisão consciente.
    const r = await controlador(linha).me(req);
    expect(Object.keys(r).sort()).toEqual([
      'conselho', 'conselhoNumero', 'conselhoUf', 'email', 'id', 'nome', 'papel',
    ]);
  });
});

describe('UsersController.atualizarMe', () => {
  const auditoria = { log: jest.fn() };
  const req = { user: { sub: 'u1', workspaceId: 'ws1' } };

  function comLinha(linha: any) {
    const repo = {
      findOne: jest.fn().mockResolvedValue(linha),
      save: jest.fn().mockImplementation(async (x) => x),
    };
    return { ctrl: new UsersController(repo as any, auditoria as any), repo };
  }

  beforeEach(() => auditoria.log.mockClear());

  const base = () => ({
    id: 'u1', fullName: 'Antigo', email: 'c@x.com', role: 'nutritionist',
    councilType: null, councilNumber: null, councilState: null,
  });

  it('grava o registro e devolve o perfil atualizado', async () => {
    const { ctrl, repo } = comLinha(base());
    const r = await ctrl.atualizarMe(
      req, { conselho: 'crn', conselhoNumero: '1234', conselhoUf: 'go' }, '1.2.3.4',
    );
    expect(repo.save).toHaveBeenCalled();
    expect(r.conselho).toBe('CRN');   // normaliza para maiúscula
    expect(r.conselhoUf).toBe('GO');
  });

  it('AUDITA com valor anterior e novo', async () => {
    // Mudar o registro muda a assinatura de tudo que for emitido daqui em
    // diante. "Perfil atualizado" não responde "quem assinou e com que
    // registro" num conflito posterior.
    const { ctrl } = comLinha({ ...base(), fullName: 'Antigo' });
    await ctrl.atualizarMe(req, { nome: 'Claudia Santos' }, '1.2.3.4');
    expect(auditoria.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE',
      resource: 'users',
      changes: { nome: { de: 'Antigo', para: 'Claudia Santos' } },
    }));
  });

  it('sem mudanca real, NAO grava auditoria', async () => {
    // Auditoria cheia de "atualizou" sem mudanca e auditoria que ninguem le.
    const { ctrl, repo } = comLinha({ ...base(), fullName: 'Claudia' });
    await ctrl.atualizarMe(req, { nome: 'Claudia' }, '1.2.3.4');
    expect(repo.save).not.toHaveBeenCalled();
    expect(auditoria.log).not.toHaveBeenCalled();
  });

  it('recusa conselho sem numero', async () => {
    const { ctrl } = comLinha(base());
    await expect(ctrl.atualizarMe(req, { conselho: 'CRN' }, '1.2.3.4'))
      .rejects.toThrow(/juntos/);
  });

  it('NAO deixa mudar papel, e-mail nem workspace', async () => {
    // Papel e autorizacao: editar o proprio seria escalada de privilegio.
    const { ctrl } = comLinha(base());
    const r = await ctrl.atualizarMe(
      req, { nome: 'Nova', role: 'admin', email: 'x@y.com' } as any, '1.2.3.4',
    );
    expect(r.papel).toBe('nutritionist');
    expect(r.email).toBe('c@x.com');
  });
});
