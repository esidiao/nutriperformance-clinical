import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MealPlansService } from './meal-plans.service';
import { MealPlan } from './meal-plan.entity';
import { MealPlanItem } from './meal-plan-item.entity';
import { Food } from '../foods/food.entity';
import { AuditService } from '../audit/audit.service';

const WS = 'ws-1';
const USER = 'user-1';
const PLAN = 'plan-1';

const planoAtivo = { id: PLAN, workspaceId: WS, nome: 'Plano A', isActive: true } as any;

const alimento = {
  id: 'food-1', ativo: true, confiabilidade: 'alta',
  nomePadronizado: 'Arroz branco cozido', fonte: 'TBCA',
  energiaKcal: 128, proteinasG: 2.5, carboidratosG: 28.1,
  lipidiosG: 0.2, fibrasG: 1.6, sodioMg: 1,
} as any;

describe('MealPlansService', () => {
  let svc: MealPlansService;
  let planRepo: any;
  let itemRepo: any;
  let foodRepo: any;
  let audit: any;

  beforeEach(async () => {
    planRepo = {
      create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: PLAN, ...d })),
      findOne: jest.fn(), findOneOrFail: jest.fn(), find: jest.fn(), update: jest.fn(),
    };
    itemRepo = {
      create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: 'item-1', ...d })),
      find: jest.fn(async () => []), findOne: jest.fn(), delete: jest.fn(),
    };
    foodRepo = { findOne: jest.fn() };
    audit = { log: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        MealPlansService,
        { provide: getRepositoryToken(MealPlan), useValue: planRepo },
        { provide: getRepositoryToken(MealPlanItem), useValue: itemRepo },
        { provide: getRepositoryToken(Food), useValue: foodRepo },
        { provide: AuditService, useValue: audit },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    svc = mod.get(MealPlansService);
  });

  describe('create', () => {
    it('exige patientId', async () => {
      await expect(svc.create(WS, USER, { nome: 'X' } as any)).rejects.toThrow(BadRequestException);
    });

    it('exige nome não vazio', async () => {
      await expect(svc.create(WS, USER, { patientId: 'p1', nome: '   ' } as any))
        .rejects.toThrow(BadRequestException);
    });

    it('grava com workspace e autor do token, não do payload', async () => {
      await svc.create(WS, USER, { patientId: 'p1', nome: 'Plano', workspaceId: 'outro', createdBy: 'outro' } as any);
      expect(planRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: WS, createdBy: USER }),
      );
      expect(audit.log).toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('recusa refeição fora da lista', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      await expect(svc.addItem(WS, USER, PLAN, { refeicao: 'brunch', quantidadeG: 100 } as any))
        .rejects.toThrow(BadRequestException);
    });

    it('recusa quantidade zero ou negativa', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      await expect(svc.addItem(WS, USER, PLAN, { refeicao: 'almoco', quantidadeG: 0 } as any))
        .rejects.toThrow(BadRequestException);
    });

    it('copia os valores do alimento proporcionais à quantidade', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      foodRepo.findOne.mockResolvedValue(alimento);

      // 150 g de um alimento tabelado por 100 g => fator 1,5
      await svc.addItem(WS, USER, PLAN, {
        refeicao: 'almoco', quantidadeG: 150, foodId: 'food-1',
      } as any);

      expect(itemRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        alimentoNome: 'Arroz branco cozido',
        kcal: 192,            // 128 * 1.5
        proteinasG: 3.75,     // 2.5 * 1.5
        carboidratosG: 42.15, // 28.1 * 1.5
        lipidiosG: 0.3,
        fibrasG: 2.4,
        sodioMg: 1.5,
        foodId: 'food-1',
        fonte: 'TBCA',
      }));
    });

    it('recusa alimento em revisão pela curadoria', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      foodRepo.findOne.mockResolvedValue({ ...alimento, confiabilidade: 'pendente' });
      await expect(svc.addItem(WS, USER, PLAN, {
        refeicao: 'almoco', quantidadeG: 100, foodId: 'food-1',
      } as any)).rejects.toThrow(BadRequestException);
      expect(itemRepo.save).not.toHaveBeenCalled();
    });

    it('recusa alimento inexistente ou inativo', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      foodRepo.findOne.mockResolvedValue(null);
      await expect(svc.addItem(WS, USER, PLAN, {
        refeicao: 'almoco', quantidadeG: 100, foodId: 'sumiu',
      } as any)).rejects.toThrow(NotFoundException);
    });

    it('aceita item manual sem foodId', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      await svc.addItem(WS, USER, PLAN, {
        refeicao: 'ceia', quantidadeG: 200, alimentoNome: 'Vitamina caseira', kcal: 210,
      } as any);
      expect(itemRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        alimentoNome: 'Vitamina caseira', kcal: 210, foodId: null,
      }));
    });

    it('exige nome quando não há foodId', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      await expect(svc.addItem(WS, USER, PLAN, { refeicao: 'ceia', quantidadeG: 50 } as any))
        .rejects.toThrow(BadRequestException);
    });

    it('não adiciona item a plano de outro workspace', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(svc.addItem(WS, USER, PLAN, { refeicao: 'almoco', quantidadeG: 100 } as any))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('somar', () => {
    it('soma e arredonda em duas casas', () => {
      const t = svc.somar([
        { kcal: 128.333, proteinasG: 2.5, carboidratosG: 28.1, lipidiosG: 0.2, fibrasG: 1.6, sodioMg: 1 },
        { kcal: 71.667, proteinasG: 7.5, carboidratosG: 1.9, lipidiosG: 4.8, fibrasG: 0, sodioMg: 55 },
      ] as any);
      expect(t.kcal).toBe(200);
      expect(t.proteinasG).toBe(10);
      expect(t.carboidratosG).toBe(30);
      expect(t.sodioMg).toBe(56);
    });

    it('trata valores nulos como zero em vez de gerar NaN', () => {
      const t = svc.somar([
        { kcal: 100, proteinasG: null, carboidratosG: undefined, lipidiosG: 'x', fibrasG: 2, sodioMg: 3 },
      ] as any);
      expect(t.kcal).toBe(100);
      expect(t.proteinasG).toBe(0);
      expect(t.carboidratosG).toBe(0);
      expect(t.lipidiosG).toBe(0);
    });

    it('devolve zeros para plano vazio', () => {
      expect(svc.somar([])).toEqual({
        kcal: 0, proteinasG: 0, carboidratosG: 0, lipidiosG: 0, fibrasG: 0, sodioMg: 0,
      });
    });
  });

  describe('findOne', () => {
    it('agrupa por refeição e devolve totais', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      itemRepo.find.mockResolvedValue([
        { refeicao: 'almoco', kcal: 100, proteinasG: 5, carboidratosG: 0, lipidiosG: 0, fibrasG: 0, sodioMg: 0 },
        { refeicao: 'almoco', kcal: 50, proteinasG: 2, carboidratosG: 0, lipidiosG: 0, fibrasG: 0, sodioMg: 0 },
        { refeicao: 'jantar', kcal: 30, proteinasG: 1, carboidratosG: 0, lipidiosG: 0, fibrasG: 0, sodioMg: 0 },
      ]);

      const r: any = await svc.findOne(WS, PLAN);
      expect(r.refeicoes).toHaveLength(2);
      expect(r.refeicoes[0].refeicao).toBe('almoco');
      expect(r.refeicoes[0].totais.kcal).toBe(150);
      expect(r.totais.kcal).toBe(180);
      expect(r.totais.proteinasG).toBe(8);
    });

    it('não devolve plano de outro workspace', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(svc.findOne(WS, PLAN)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('ignora tentativa de trocar workspace, autor ou paciente', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      planRepo.findOneOrFail.mockResolvedValue(planoAtivo);
      await svc.update(WS, USER, PLAN, {
        nome: 'Novo nome', workspaceId: 'invasor', createdBy: 'invasor', patientId: 'outro',
      } as any);
      expect(planRepo.update).toHaveBeenCalledWith(PLAN, { nome: 'Novo nome' });
    });

    it('não chama update quando só vêm campos protegidos', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      await svc.update(WS, USER, PLAN, { workspaceId: 'invasor' } as any);
      expect(planRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('desativa em vez de apagar — o plano é registro clínico', async () => {
      planRepo.findOne.mockResolvedValue(planoAtivo);
      await svc.remove(WS, USER, PLAN);
      expect(planRepo.update).toHaveBeenCalledWith(PLAN, { isActive: false });
    });
  });
});
