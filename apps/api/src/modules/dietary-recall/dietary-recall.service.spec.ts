import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DietaryRecallService, TIPOS_DE_DIA } from './dietary-recall.service';
import { DietaryRecall } from './dietary-recall.entity';
import { DietaryRecallItem } from './dietary-recall-item.entity';
import { Food } from '../foods/food.entity';
import { AuditService } from '../audit/audit.service';

const WS = 'ws-1';
const USER = 'user-1';
const PACIENTE = 'pac-1';
const RECALL = 'rec-1';

const alimento = (over: any = {}): any => ({
  id: 'food-1', nomePadronizado: 'Arroz, integral, cozido', fonte: 'taco',
  ativo: true, confiabilidade: 'alta',
  energiaKcal: 124, proteinasG: 2.6, carboidratosG: 25.8, lipidiosG: 1,
  fibrasG: 2.7, sodioMg: 1, calcioMg: 5, ferroMg: 0.3,
  vitaminas: { tiamina_mg: { valor: 0.08, unidade: 'mg' } },
  ...over,
});

describe('DietaryRecallService', () => {
  let svc: DietaryRecallService;
  let repo: any;
  let itemRepo: any;
  let foodRepo: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => ({ id: RECALL, ...d })),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => ({ id: RECALL, workspaceId: WS, patientId: PACIENTE })),
      delete: jest.fn(),
    };
    itemRepo = {
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => ({ id: 'item-1', ...d })),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      delete: jest.fn(),
    };
    foodRepo = { findOne: jest.fn(async () => alimento()) };

    const mod = await Test.createTestingModule({
      providers: [
        DietaryRecallService,
        { provide: getRepositoryToken(DietaryRecall), useValue: repo },
        { provide: getRepositoryToken(DietaryRecallItem), useValue: itemRepo },
        { provide: getRepositoryToken(Food), useValue: foodRepo },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    svc = mod.get(DietaryRecallService);
  });

  describe('criar', () => {
    it('exige a data do dia recordado', async () => {
      // Nao e a data da consulta: um recordatorio feito na segunda costuma
      // cobrir o domingo, e domingo nao representa a rotina.
      await expect(svc.criar(WS, USER, { patientId: PACIENTE }))
        .rejects.toThrow(/data do dia recordado/i);
    });

    it('a mensagem explica POR QUE a data nao e a da consulta', async () => {
      await expect(svc.criar(WS, USER, { patientId: PACIENTE }))
        .rejects.toThrow(/domingo/i);
    });

    it('recusa data no futuro', async () => {
      const amanha = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
      await expect(svc.criar(WS, USER, { patientId: PACIENTE, dataReferencia: amanha }))
        .rejects.toThrow(/futuro/i);
    });

    it('exige paciente', async () => {
      await expect(svc.criar(WS, USER, { dataReferencia: '2026-10-20' }))
        .rejects.toThrow(/patientId/);
    });

    it('recusa tipo de dia invalido', async () => {
      await expect(svc.criar(WS, USER, {
        patientId: PACIENTE, dataReferencia: '2026-10-20', tipoDeDia: 'feriado',
      })).rejects.toThrow(/tipoDeDia/);
    });

    it('aceita dia util e fim de semana', () => {
      // A distincao muda a leitura do consumo e e a primeira pergunta ao
      // interpretar o resultado.
      expect([...TIPOS_DE_DIA].sort()).toEqual(['dia_util', 'fim_de_semana']);
    });

    it('grava com a data informada', async () => {
      const r: any = await svc.criar(WS, USER, {
        patientId: PACIENTE, dataReferencia: '2026-10-20', tipoDeDia: 'dia_util',
      });
      expect(r.dataReferencia).toBe('2026-10-20');
      expect(r.tipoDeDia).toBe('dia_util');
    });
  });

  describe('adicionarItem', () => {
    it('escala pelos 100 g da base, igual ao plano alimentar', async () => {
      const r: any = await svc.adicionarItem(WS, USER, RECALL, {
        refeicao: 'almoco', foodId: 'food-1', quantidadeG: 50,
      });
      // 124 kcal/100 g em 50 g = 62
      expect(r.kcal).toBe(62);
      expect(r.proteinasG).toBe(1.3);
    });

    it('copia micronutrientes ja escalados', async () => {
      const r: any = await svc.adicionarItem(WS, USER, RECALL, {
        refeicao: 'almoco', foodId: 'food-1', quantidadeG: 200,
      });
      expect(r.micronutrientes.calcioMg).toBe(10);
      expect(r.micronutrientes.tiaminaMg).toBe(0.16);
    });

    it('nutriente ausente na base NAO vira zero', async () => {
      foodRepo.findOne.mockResolvedValue(alimento({ zincoMg: null }));
      const r: any = await svc.adicionarItem(WS, USER, RECALL, {
        refeicao: 'almoco', foodId: 'food-1', quantidadeG: 100,
      });
      expect('zincoMg' in r.micronutrientes).toBe(false);
    });

    it('item digitado a mao fica sem micronutriente CONHECIDO', async () => {
      // `{}` e diferente de zerado: o relatorio trata como cobertura
      // incompleta em vez de somar zeros.
      const r: any = await svc.adicionarItem(WS, USER, RECALL, {
        refeicao: 'cafe_manha', alimentoNome: 'Pão da padaria', quantidadeG: 50, kcal: 140,
      });
      expect(r.micronutrientes).toEqual({});
      expect(r.kcal).toBe(140);
    });

    it('recusa alimento em revisao pela curadoria', async () => {
      // Contabilizar consumo com composicao duvidosa produz total que parece
      // medido e nao e.
      foodRepo.findOne.mockResolvedValue(alimento({ confiabilidade: 'pendente' }));
      await expect(svc.adicionarItem(WS, USER, RECALL, {
        refeicao: 'almoco', foodId: 'food-1', quantidadeG: 100,
      })).rejects.toThrow(/revisão pela curadoria/i);
    });

    it('recusa alimento inexistente com NotFound', async () => {
      foodRepo.findOne.mockResolvedValue(null);
      await expect(svc.adicionarItem(WS, USER, RECALL, {
        refeicao: 'almoco', foodId: 'sumiu', quantidadeG: 100,
      })).rejects.toThrow(NotFoundException);
    });

    it('recusa refeicao invalida', async () => {
      await expect(svc.adicionarItem(WS, USER, RECALL, {
        refeicao: 'brunch', foodId: 'food-1', quantidadeG: 100,
      })).rejects.toThrow(/Refeição inválida/);
    });

    it('recusa quantidade zero', async () => {
      await expect(svc.adicionarItem(WS, USER, RECALL, {
        refeicao: 'almoco', foodId: 'food-1', quantidadeG: 0,
      })).rejects.toThrow(/maior que zero/);
    });

    it('nao adiciona item a recordatorio de outro workspace', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.adicionarItem(WS, USER, 'alheio', {
        refeicao: 'almoco', foodId: 'food-1', quantidadeG: 100,
      })).rejects.toThrow(NotFoundException);
    });

    it('guarda a medida caseira como o paciente descreveu', async () => {
      const r: any = await svc.adicionarItem(WS, USER, RECALL, {
        refeicao: 'almoco', foodId: 'food-1', quantidadeG: 90,
        medidaCaseira: 'três colheres de sopa',
      });
      expect(r.medidaCaseira).toBe('três colheres de sopa');
    });
  });

  describe('somar', () => {
    const item = (over: any = {}): any => ({
      kcal: 100, proteinasG: 5, carboidratosG: 20, lipidiosG: 2,
      fibrasG: 1, sodioMg: 10, micronutrientes: { calcioMg: 50 }, ...over,
    });

    it('soma macros e micros', () => {
      const t = svc.somar([item(), item()]);
      expect(t.kcal).toBe(200);
      expect(t.micronutrientes.calcioMg.valor).toBe(100);
    });

    it('marca cobertura INCOMPLETA quando um item nao tem o nutriente', () => {
      // Somar 1 de 2 produz total menor que parece real; lido contra a RDA,
      // viraria "abaixo da recomendacao" que o dado nao sustenta.
      const t = svc.somar([item(), item({ micronutrientes: {} })]);
      expect(t.micronutrientes.calcioMg.completo).toBe(false);
      expect(t.micronutrientes.calcioMg.itensComDado).toBe(1);
      expect(t.micronutrientes.calcioMg.itensTotal).toBe(2);
    });

    it('recordatorio vazio devolve zeros e micros vazios', () => {
      const t = svc.somar([]);
      expect(t.kcal).toBe(0);
      expect(t.micronutrientes).toEqual({});
    });
  });

  describe('separacao de prescricao', () => {
    it('NAO existe metodo que transforme recordatorio em plano', () => {
      // Recordatorio e o que o paciente RELATOU; plano e o que foi PRESCRITO.
      // Uma conversao automatica faria o relato virar prescricao assinada sem
      // ninguem revisar. Copiar para a prescricao e acao da tela, com o
      // profissional conferindo item a item.
      const metodos = Object.getOwnPropertyNames(Object.getPrototypeOf(svc));
      for (const m of metodos) {
        expect(m).not.toMatch(/prescrever|virarPlano|converterEmPlano/i);
      }
    });
  });
});
