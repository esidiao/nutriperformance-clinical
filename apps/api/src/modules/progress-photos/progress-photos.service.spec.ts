import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProgressPhotosService, ANGULOS, MESES_RETENCAO } from './progress-photos.service';
import { ProgressPhoto } from './progress-photo.entity';
import { AuditService } from '../audit/audit.service';
import * as storage from '../../common/storage';

const WS = 'ws-1';
const USER = 'user-1';
const PACIENTE = 'paciente-1';

const foto = (over: Partial<ProgressPhoto> = {}): any => ({
  id: 'f-1', workspaceId: WS, patientId: PACIENTE, createdBy: USER,
  angulo: 'frente', fotoPath: 'evolucao/abc/f-1.jpg',
  tiradaEm: '2026-09-01', observacao: null, removidaEm: null,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe('ProgressPhotosService', () => {
  let svc: ProgressPhotosService;
  let repo: any;
  let audit: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: 'f-1', ...d })),
      find: jest.fn(async () => []), findOne: jest.fn(async () => null),
      findOneOrFail: jest.fn(async () => ({ id: 'f-1' })),
      update: jest.fn(), delete: jest.fn(), count: jest.fn(async () => 0),
    };
    audit = { log: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        ProgressPhotosService,
        { provide: getRepositoryToken(ProgressPhoto), useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    svc = mod.get(ProgressPhotosService);

    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave';
    process.env.SUPABASE_STORAGE_BUCKET = 'bucket';
    jest.restoreAllMocks();
  });

  describe('criar', () => {
    beforeEach(() => {
      jest.spyOn(storage, 'urlDeEnvio').mockResolvedValue({ url: 'https://x', expiraEmS: 600 });
    });

    it('exige ângulo válido', async () => {
      // Comparação só vale entre fotos do mesmo ponto de vista.
      await expect(svc.criar(WS, USER, {
        patientId: PACIENTE, angulo: 'diagonal', mimeFoto: 'image/jpeg',
      })).rejects.toThrow(/mesmo ponto de vista/);
    });

    it('exige paciente', async () => {
      await expect(svc.criar(WS, USER, { angulo: 'frente', mimeFoto: 'image/jpeg' }))
        .rejects.toThrow(/patientId/);
    });

    it('recusa formato não aceito', async () => {
      await expect(svc.criar(WS, USER, {
        patientId: PACIENTE, angulo: 'frente', mimeFoto: 'application/pdf',
      })).rejects.toThrow(/Formato de imagem/);
    });

    it('recusa data no futuro', async () => {
      const amanha = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
      await expect(svc.criar(WS, USER, {
        patientId: PACIENTE, angulo: 'frente', mimeFoto: 'image/jpeg', tiradaEm: amanha,
      })).rejects.toThrow(/futuro/);
    });

    it('devolve URL de envio e grava o caminho', async () => {
      const r = await svc.criar(WS, USER, {
        patientId: PACIENTE, angulo: 'frente', mimeFoto: 'image/jpeg',
      });
      expect(r.envio.url).toBe('https://x');
      const [, mudancas] = repo.update.mock.calls[0];
      expect(mudancas.fotoPath).toMatch(/^evolucao\//);
    });

    it('o caminho não revela paciente nem workspace', async () => {
      // Mesma razão do diário: a URL assinada carrega o caminho do objeto.
      await svc.criar(WS, USER, {
        patientId: PACIENTE, angulo: 'frente', mimeFoto: 'image/jpeg',
      });
      const [, mudancas] = repo.update.mock.calls[0];
      expect(mudancas.fotoPath).not.toContain(PACIENTE);
      expect(mudancas.fotoPath).not.toContain(WS);
    });

    it('sem storage configurado, não grava nada', async () => {
      delete process.env.SUPABASE_URL;
      await expect(svc.criar(WS, USER, {
        patientId: PACIENTE, angulo: 'frente', mimeFoto: 'image/jpeg',
      })).rejects.toThrow(/não configurado/);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('agrupa por ângulo', async () => {
      jest.spyOn(storage, 'urlDeLeitura').mockResolvedValue('https://assinada');
      repo.find.mockResolvedValue([
        foto({ id: 'a', angulo: 'frente' }),
        foto({ id: 'b', angulo: 'costas' }),
        foto({ id: 'c', angulo: 'frente' }),
      ]);
      const r = await svc.listar(WS, PACIENTE);
      const frente = r.find((g) => g.angulo === 'frente');
      expect(frente?.fotos).toHaveLength(2);
      expect(r.find((g) => g.angulo === 'costas')?.fotos).toHaveLength(1);
    });

    it('não devolve o caminho no bucket', async () => {
      jest.spyOn(storage, 'urlDeLeitura').mockResolvedValue('https://assinada');
      repo.find.mockResolvedValue([foto()]);
      const r = await svc.listar(WS, PACIENTE);
      expect(JSON.stringify(r)).not.toContain('evolucao/abc');
    });

    it('ângulo sem foto não aparece', async () => {
      repo.find.mockResolvedValue([]);
      const r = await svc.listar(WS, PACIENTE);
      expect(r).toEqual([]);
    });
  });

  describe('remover', () => {
    it('apaga do Storage ANTES do banco', async () => {
      const ordem: string[] = [];
      jest.spyOn(storage, 'remover').mockImplementation(async () => { ordem.push('storage'); return 1; });
      repo.findOne.mockResolvedValue(foto());
      repo.delete.mockImplementation(async () => { ordem.push('banco'); });

      await svc.remover(WS, USER, 'f-1');
      expect(ordem).toEqual(['storage', 'banco']);
    });

    it('Storage não confirmando, o banco não é tocado', async () => {
      jest.spyOn(storage, 'remover').mockResolvedValue(0);
      repo.findOne.mockResolvedValue(foto());
      await expect(svc.remover(WS, USER, 'f-1')).rejects.toThrow(/não confirmou/);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('apaga de verdade, não desativa', async () => {
      // Se a pessoa pede que a imagem do corpo dela saia, guardar cópia
      // "inativa" atende a conveniência do sistema, não o pedido dela.
      jest.spyOn(storage, 'remover').mockResolvedValue(1);
      repo.findOne.mockResolvedValue(foto());
      await svc.remover(WS, USER, 'f-1');
      expect(repo.delete).toHaveBeenCalledWith('f-1');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('404 para foto de outro workspace', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.remover(WS, USER, 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('expurgar', () => {
    const antiga = () => foto({ createdAt: new Date(Date.now() - 400 * 864e5) });

    it('a retenção é de 12 meses', () => {
      expect(MESES_RETENCAO).toBe(12);
    });

    it('simular não apaga nada', async () => {
      repo.find.mockResolvedValue([antiga()]);
      const rem = jest.spyOn(storage, 'remover');
      const r = await svc.expurgar({ simular: true });
      expect(r.encontradas).toBe(1);
      expect(rem).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('Storage primeiro, banco depois', async () => {
      const ordem: string[] = [];
      jest.spyOn(storage, 'remover').mockImplementation(async () => { ordem.push('storage'); return 1; });
      repo.find.mockResolvedValue([antiga()]);
      repo.delete.mockImplementation(async () => { ordem.push('banco'); });
      await svc.expurgar({});
      expect(ordem).toEqual(['storage', 'banco']);
    });

    it('apaga o REGISTRO também, diferente do diário', async () => {
      // Registro de foto sem a foto é só um carimbo de que existiu uma imagem
      // que ninguém pode mais ver.
      jest.spyOn(storage, 'remover').mockResolvedValue(1);
      repo.find.mockResolvedValue([antiga()]);
      await svc.expurgar({});
      expect(repo.delete).toHaveBeenCalled();
    });

    it('nada antigo não chama o Storage', async () => {
      repo.find.mockResolvedValue([]);
      const rem = jest.spyOn(storage, 'remover');
      const r = await svc.expurgar({});
      expect(r.encontradas).toBe(0);
      expect(rem).not.toHaveBeenCalled();
    });
  });

  describe('escopo do módulo', () => {
    it('cobre os três ângulos que se compara', () => {
      expect([...ANGULOS].sort()).toEqual(['costas', 'frente', 'perfil']);
    });

    it('NÃO existe método que estime composição corporal', () => {
      // A decisão central da lacuna 11. Um percentual de gordura estimado por
      // modelo generalista pareceria medida clínica, entraria no prontuário ao
      // lado da bioimpedância e viraria conduta — sem validação nenhuma.
      const metodos = Object.getOwnPropertyNames(Object.getPrototypeOf(svc));
      for (const m of metodos) {
        expect(m).not.toMatch(/estimar|composicao|gordura|bodyFat/i);
      }
    });
  });
});
