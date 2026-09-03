import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { TokenService } from './token.service';
import { TokenTransaction } from './token-transaction.entity';
import { TokenCost } from './token-cost.entity';
import { Workspace } from '../workspaces/workspace.entity';

const mockWorkspace = (balance: number, reserved = 0) => ({
  id: 'ws-1',
  tokenBalance: balance,
  tokenReserved: reserved,
});

const mockQb = (workspace: any) => ({
  setLock: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getOneOrFail: jest.fn().mockResolvedValue({ ...workspace }),
});

function makeDataSource(workspace: any) {
  let saved: any;
  return {
    transaction: jest.fn().mockImplementation(async (cb: any) => {
      const em = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn().mockReturnValue(mockQb(workspace)),
          create: jest.fn().mockImplementation((d) => d),
          save: jest.fn().mockImplementation((v) => { saved = v; return v; }),
        }),
        save: jest.fn().mockImplementation((v) => v),
      };
      return cb(em);
    }),
    getSaved: () => saved,
  };
}

describe('TokenService', () => {
  let service: TokenService;

  const mockCostRepo = {
    findOne: jest.fn().mockResolvedValue({ operation: 'interaction_analysis', tokensCost: 15 }),
    find: jest.fn().mockResolvedValue([
      { operation: 'assistant_query', tokensCost: 5, description: 'Assistente' },
      { operation: 'interaction_analysis', tokensCost: 15, description: 'Interações' },
    ]),
  };
  const mockTxRepo = { find: jest.fn().mockResolvedValue([]) };
  const mockWsRepo = {
    findOneOrFail: jest.fn().mockResolvedValue(mockWorkspace(100)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: getRepositoryToken(Workspace), useValue: mockWsRepo },
        { provide: getRepositoryToken(TokenTransaction), useValue: mockTxRepo },
        { provide: getRepositoryToken(TokenCost), useValue: mockCostRepo },
        { provide: getDataSourceToken(), useValue: makeDataSource(mockWorkspace(100)) },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  describe('consume', () => {
    it('deducts tokens when balance is sufficient', async () => {
      const ds = makeDataSource(mockWorkspace(100));
      (service as any).dataSource = ds;

      await service.consume({
        workspaceId: 'ws-1',
        userId: 'user-1',
        operation: 'interaction_analysis',
        cost: 15,
      });

      expect(ds.transaction).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      const ds = makeDataSource(mockWorkspace(10)); // only 10, need 15
      (service as any).dataSource = ds;

      await expect(
        service.consume({
          workspaceId: 'ws-1',
          userId: 'user-1',
          operation: 'interaction_analysis',
          cost: 15,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('respects reserved tokens when checking available balance', async () => {
      // balance=20 but reserved=10 → available=10, need 15 → should fail
      const ds = makeDataSource(mockWorkspace(20, 10));
      (service as any).dataSource = ds;

      await expect(
        service.consume({
          workspaceId: 'ws-1',
          userId: 'user-1',
          operation: 'interaction_analysis',
          cost: 15,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBalance', () => {
    it('returns available = balance - reserved', async () => {
      mockWsRepo.findOneOrFail.mockResolvedValueOnce(mockWorkspace(200, 30));
      const result = await service.getBalance('ws-1');
      expect(result.available).toBe(170);
      expect(result.balance).toBe(200);
      expect(result.reserved).toBe(30);
    });
  });

  describe('adminAdjust', () => {
    it('calls credit with admin_adjustment operation', async () => {
      const creditSpy = jest.spyOn(service, 'credit').mockResolvedValue({} as any);
      await service.adminAdjust({
        workspaceId: 'ws-1',
        amount: 500,
        reason: 'Bônus de boas-vindas',
        adminUserId: 'admin-1',
      });
      expect(creditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'admin_adjustment', amount: 500 }),
      );
    });
  });

  describe('listarCustos', () => {
    it('devolve o que esta na tabela, nao uma lista escrita no codigo', async () => {
      // A rota /tokens/costs anunciava um array fixo no controller: mostrava um
      // nome de operacao ja renomeado, omitia as cinco realmente tarifadas e
      // listava quatro que nenhum codigo executa. Editar o preco pelo painel
      // nao mudava nada do que o usuario via.
      const r = await service.listarCustos();
      expect(r.map((c) => c.operation)).toEqual(['assistant_query', 'interaction_analysis']);
      expect(mockCostRepo.find).toHaveBeenCalled();
    });

    it('mantem o formato que o cliente ja esperava', async () => {
      const [primeiro] = await service.listarCustos();
      expect(Object.keys(primeiro).sort()).toEqual(['description', 'operation', 'tokens']);
    });

    it('o preco listado e o mesmo que getCostFor cobra', async () => {
      // Se as duas fontes divergirem, a lista vira propaganda enganosa.
      const listado = (await service.listarCustos())
        .find((c) => c.operation === 'interaction_analysis')!.tokens;
      expect(listado).toBe(await service.getCostFor('interaction_analysis'));
    });
  });
});
