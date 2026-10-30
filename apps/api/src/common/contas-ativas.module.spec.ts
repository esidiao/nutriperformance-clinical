import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ContasAtivasModule } from './contas-ativas.module';
import { ContasAtivasService } from './contas-ativas.service';

/**
 * Prova que a fiacao resolve.
 *
 * Os testes unitarios do servico o constroem com `new`, passando um
 * `DataSource` de mentira — isso mede a regra, nao a injecao. Um token errado
 * no `@InjectDataSource()` passaria por todos eles e so apareceria no boot,
 * como deploy que sobe e morre.
 */
describe('ContasAtivasModule', () => {
  it('o container resolve o servico com o DataSource injetado', async () => {
    const query = jest.fn().mockResolvedValue([{ usuario_ativo: true, workspace_ativo: true }]);

    const modulo = await Test.createTestingModule({
      providers: [
        ContasAtivasService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
      ],
    }).compile();

    const servico = modulo.get(ContasAtivasService);
    await expect(servico.motivoParaNegar('sub-1', 'ws-1')).resolves.toBeNull();
    // O DataSource injetado e o que o servico realmente usa.
    expect(query).toHaveBeenCalled();

    await modulo.close();
  });

  it('o modulo fornece E exporta o servico, e e global', () => {
    // O `JwtAuthGuard` e `APP_GUARD` no modulo raiz e o painel administrativo
    // precisa da MESMA instancia para limpar o cache. Sem `@Global()` + export,
    // o painel ganharia um segundo cache e `limparCache()` nao faria efeito
    // sobre o cache que o guard consulta — sem erro nenhum aparecendo.
    const provedores = Reflect.getMetadata('providers', ContasAtivasModule) ?? [];
    const exportados = Reflect.getMetadata('exports', ContasAtivasModule) ?? [];
    expect(provedores).toContain(ContasAtivasService);
    expect(exportados).toContain(ContasAtivasService);
    expect(Reflect.getMetadata('__module:global__', ContasAtivasModule)).toBe(true);
  });
});
