import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  COLUNAS_COM_ID_DE_CONTA,
  conferirIdentidadeDaConta,
} from './identidade-da-conta';

/**
 * Catraca da invariante `users.id` === `users.auth_id`.
 *
 * Não é um teste de comportamento: é uma trava sobre a SUPOSIÇÃO que o sistema
 * faz sem nunca ter escrito. Ver `identidade-da-conta.ts` para a cadeia inteira
 * e para o incidente de 22/10/2026 que motivou isso.
 *
 * O desenho segue a regra que já aprendemos aqui: guarda contra regressão lista
 * as ocorrências legítimas e falha só nas NOVAS. Um teste que obrigasse a mexer
 * no que funciona seria desligado na primeira vez que incomodasse.
 */

const RAIZ = join(__dirname, '..');

function arquivosDeEntidade(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) achados.push(...arquivosDeEntidade(caminho));
    else if (nome.endsWith('.entity.ts')) achados.push(caminho);
  }
  return achados;
}

describe('invariante: users.id é o UUID do Supabase Auth', () => {
  it('o guard põe o sub do token em req.user.id — é daí que vem o created_by', async () => {
    // Se um dia o guard passar a buscar o id na tabela `users`, a invariante
    // deixa de ser necessária: este teste falha e manda reescrever a decisão.
    const reflector = new Reflector();
    const guard = new JwtAuthGuard(reflector);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jest.spyOn(guard as any, 'verifyToken').mockResolvedValue({
      sub: 'uuid-do-auth',
      app_metadata: { role: 'nutritionist', workspace_id: 'ws-1' },
    });

    const request: any = { headers: { authorization: 'Bearer t' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);
    expect(request.user.id).toBe('uuid-do-auth');
    expect(request.user.id).toBe(request.user.sub);
  });

  it('patients.created_by é FK de users.id, não de users.auth_id', () => {
    // A ponta que fecha a cadeia. Repontar para `auth_id` é a correção boa, e
    // quando alguém fizer isso este teste falha para cobrar a atualização do
    // documento em vez de deixá-lo mentindo.
    const fonte = readFileSync(
      join(RAIZ, 'modules', 'patients', 'patient.entity.ts'), 'utf8',
    );
    expect(fonte).toContain("@JoinColumn({ name: 'created_by' })");
    expect(fonte).toContain('@ManyToOne(() => User)');
    // O JoinColumn sem `referencedColumnName` aponta para a PK — `users.id`.
    const trecho = fonte.slice(fonte.indexOf('@ManyToOne(() => User)'));
    expect(trecho.slice(0, 200)).not.toContain('referencedColumnName');
  });

  it('nenhuma coluna nova guarda id de conta sem passar pela invariante', () => {
    // Catraca: as 16 colunas conhecidas estão na lista; uma 17ª faz o teste
    // falhar com o recado, para quem a criou saber que o valor gravado ali tem
    // de ser o UUID do Auth.
    const conhecidas = new Set(COLUNAS_COM_ID_DE_CONTA);
    const novas: string[] = [];

    for (const arquivo of arquivosDeEntidade(join(RAIZ, 'modules'))) {
      const fonte = readFileSync(arquivo, 'utf8');
      const tabela = fonte.match(/@Entity\('([^']+)'\)/)?.[1];
      if (!tabela) continue;
      for (const m of fonte.matchAll(/@Column\(\{\s*name:\s*'(created_by|user_id)'/g)) {
        const coluna = `${tabela}.${m[1]}`;
        if (!conhecidas.has(coluna)) novas.push(coluna);
      }
    }

    expect(novas).toEqual([]);
  });

  it('a lista não envelhece: toda coluna listada ainda existe', () => {
    // O outro lado da catraca. Lista que só cresce vira enfeite: se a coluna
    // sumiu, a entrada tem de sair, senão a lista para de descrever o sistema.
    const existentes = new Set<string>();
    for (const arquivo of arquivosDeEntidade(join(RAIZ, 'modules'))) {
      const fonte = readFileSync(arquivo, 'utf8');
      const tabela = fonte.match(/@Entity\('([^']+)'\)/)?.[1];
      if (!tabela) continue;
      for (const m of fonte.matchAll(/@Column\(\{\s*name:\s*'(created_by|user_id)'/g)) {
        existentes.add(`${tabela}.${m[1]}`);
      }
    }
    const sumiram = COLUNAS_COM_ID_DE_CONTA.filter((c) => !existentes.has(c));
    expect(sumiram).toEqual([]);
  });
});

describe('conferirIdentidadeDaConta', () => {
  it('aceita a linha em que id e auth_id são o mesmo valor', () => {
    expect(conferirIdentidadeDaConta({ id: 'u1', authId: 'u1' })).toBeNull();
  });

  it('recusa id diferente de auth_id, dizendo que a ESCRITA é que falha', () => {
    const problema = conferirIdentidadeDaConta({ id: 'interno-1', authId: 'auth-1' });
    expect(problema).toMatch(/TODA escrita falha/);
  });

  it('distingue a conta sem auth_id, que falha no login e não na escrita', () => {
    expect(conferirIdentidadeDaConta({ id: 'u1', authId: null }))
      .toMatch(/não autentica/);
  });

  it('o marcador das contas semeadas é recusado como id diferente', () => {
    // As contas semeadas nasceram com auth_id de marcador ("auth-nutri-001").
    // É este caso concreto que derrubou as escritas em 22/10/2026.
    expect(conferirIdentidadeDaConta({
      id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      authId: 'auth-nutri-001',
    })).toMatch(/created_by aponta para um id que não existe/);
  });
});
