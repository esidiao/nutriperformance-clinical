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

  function controlador(achar: any) {
    return new UsersController({ findOne: jest.fn().mockResolvedValue(achar) } as any);
  }

  const req = { user: { sub: 'u1', workspaceId: 'ws1' } };

  it('devolve nome e registro de quem pediu', async () => {
    const r = await controlador(linha).me(req);
    expect(r.nome).toBe('Claudia Santos');
    expect(r.registro).toBe('CRN 12345/GO');
  });

  it('busca pelo sub do token E pelo workspace', async () => {
    // Sem o workspace, um id vazado de outra clínica devolveria a identidade
    // de lá. O filtro duplo é barato e fecha isso.
    const repo = { findOne: jest.fn().mockResolvedValue(linha) };
    await new UsersController(repo as any).me(req);
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

  it('registro é null quando falta conselho, e não uma string torta', async () => {
    const semConselho = { ...linha, councilType: null, councilNumber: null };
    const r = await controlador(semConselho).me(req);
    expect(r.registro).toBeNull();
  });

  it('sem UF, o registro sai sem a barra solta', async () => {
    const r = await controlador({ ...linha, councilState: null }).me(req);
    expect(r.registro).toBe('CRN 12345');
  });

  it('não devolve campo que não foi pedido', async () => {
    // A rota é sobre QUEM ASSINA. Crescer aqui é publicar dado de conta para
    // o front sem decisão consciente.
    const r = await controlador(linha).me(req);
    expect(Object.keys(r).sort()).toEqual([
      'conselho', 'conselhoNumero', 'conselhoUf', 'email', 'id', 'nome',
      'papel', 'registro',
    ]);
  });
});
