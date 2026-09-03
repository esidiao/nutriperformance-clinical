import { PrecoConfiguradoService } from './preco-configurado.service';

/**
 * O valor deste serviço é derrubar o boot quando falta preço. Um teste que só
 * verifica o caminho feliz não prova nada — é justamente o caminho feliz que
 * o guard já entregava enquanto cinco operações passavam sem conferir saldo.
 */
describe('PrecoConfiguradoService', () => {
  const montar = (declaradas: string[], noBanco: string[] | Error) => {
    const svc = new PrecoConfiguradoService(
      {} as any, {} as any, {} as any,
      {
        find: async () => {
          if (noBanco instanceof Error) throw noBanco;
          return noBanco.map((operation) => ({ operation }));
        },
      } as any,
    );
    jest.spyOn(svc, 'operacoesDeclaradas').mockReturnValue(declaradas);
    return svc;
  };

  it('derruba o boot quando uma operação declarada não tem preço', async () => {
    const svc = montar(['interaction_analysis', 'laboratory_analysis'], ['interaction_analysis']);
    await expect(svc.onApplicationBootstrap()).rejects.toThrow(/laboratory_analysis/);
  });

  it('a mensagem diz POR QUE isso importa, não só o que falta', async () => {
    // Quem lê o log no meio de um deploy precisa entender a consequência sem
    // ir atrás do código do guard.
    const svc = montar(['assistant_query'], []);
    await expect(svc.onApplicationBootstrap())
      .rejects.toThrow(/sem conferir saldo/);
  });

  it('sobe normalmente quando todas têm preço', async () => {
    const svc = montar(['interaction_analysis'], ['interaction_analysis', 'outra_qualquer']);
    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('preço sobrando na tabela não derruba nada', async () => {
    // Tarifa sem uso é questão de produto, não de segurança: não cria chamada
    // paga sem saldo conferido.
    const svc = montar([], ['clinical_alert_processing']);
    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('banco fora no boot vira aviso, não ciclo de reinício', async () => {
    // Derrubar aqui transformaria uma oscilação de rede em crash-loop, que é o
    // oposto do que a verificação quer.
    const svc = montar(['interaction_analysis'], new Error('ECONNREFUSED'));
    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
