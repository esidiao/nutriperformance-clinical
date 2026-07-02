import { Reflector } from '@nestjs/core';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { RolesGuard, ROLES_KEY } from './roles.guard';

function makeContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('permite acesso quando nenhum papel é exigido', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ role: 'nutritionist' }))).toBe(true);
  });

  it('permite acesso quando o papel do usuário está na lista exigida', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'nutritionist']);
    expect(guard.canActivate(makeContext({ role: 'nutritionist' }))).toBe(true);
  });

  it('nega acesso quando o papel não está na lista exigida', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    expect(() => guard.canActivate(makeContext({ role: 'nutritionist' }))).toThrow(ForbiddenException);
  });

  it('nega acesso quando não há usuário autenticado', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('permite acesso quando a lista de papéis exigidos está vazia', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(guard.canActivate(makeContext({ role: 'qualquer' }))).toBe(true);
  });

  it('lê os metadados usando ROLES_KEY do handler e da classe', () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    try { guard.canActivate(makeContext({ role: 'admin' })); } catch { /* noop */ }
    expect(spy).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });
});
