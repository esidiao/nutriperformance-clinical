import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { Appointment } from './appointment.entity';
import { AuditService } from '../audit/audit.service';

const WS = 'ws-1';
const USER = 'user-1';

const emUma = (horas: number) => new Date(Date.now() + horas * 3600_000);
const hoursAgo = (horas: number) => new Date(Date.now() - horas * 3600_000);

describe('AppointmentsService', () => {
  let svc: AppointmentsService;
  let repo: any;
  let qb: any;
  let audit: any;

  beforeEach(async () => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    repo = {
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => ({ id: 'ap-1', ...d })),
      find: jest.fn(async () => []),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(async () => ({ id: 'ap-1' })),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => qb),
    };
    audit = { log: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: getRepositoryToken(Appointment), useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    svc = mod.get(AppointmentsService);
  });

  describe('create', () => {
    const base = () => ({ patientId: 'p1', inicio: emUma(24).toISOString(), duracaoMin: 60 });

    it('exige patientId', async () => {
      await expect(svc.create(WS, USER, { inicio: emUma(2).toISOString() }))
        .rejects.toThrow(BadRequestException);
    });

    it('recusa data inválida', async () => {
      await expect(svc.create(WS, USER, { patientId: 'p1', inicio: 'ontem' }))
        .rejects.toThrow(BadRequestException);
    });

    it('recusa duração zero ou negativa', async () => {
      await expect(svc.create(WS, USER, { ...base(), duracaoMin: 0 }))
        .rejects.toThrow(BadRequestException);
    });

    it('recusa duração acima de 8 horas — provável erro de digitação', async () => {
      await expect(svc.create(WS, USER, { ...base(), duracaoMin: 600 }))
        .rejects.toThrow(BadRequestException);
    });

    it('recusa tipo fora da lista', async () => {
      await expect(svc.create(WS, USER, { ...base(), tipo: 'urgencia' }))
        .rejects.toThrow(BadRequestException);
    });

    it('calcula o fim a partir da duração', async () => {
      const inicio = emUma(24);
      await svc.create(WS, USER, { patientId: 'p1', inicio: inicio.toISOString(), duracaoMin: 45 });
      const gravado = repo.create.mock.calls[0][0];
      expect(gravado.fim.getTime() - gravado.inicio.getTime()).toBe(45 * 60_000);
    });

    it('usa 60 minutos quando a duração não é informada', async () => {
      await svc.create(WS, USER, { patientId: 'p1', inicio: emUma(24).toISOString() });
      const g = repo.create.mock.calls[0][0];
      expect(g.fim.getTime() - g.inicio.getTime()).toBe(60 * 60_000);
    });

    it('grava workspace e autor do token, não do payload', async () => {
      await svc.create(WS, USER, { ...base(), workspaceId: 'invasor', createdBy: 'invasor' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: WS, createdBy: USER }),
      );
    });

    it('agenda na agenda de outro profissional quando informado', async () => {
      // a secretária marca na agenda da nutricionista
      await svc.create(WS, USER, { ...base(), profissionalId: 'nutri-2' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ profissionalId: 'nutri-2', createdBy: USER }),
      );
    });

    it('recusa horário que colide com consulta existente', async () => {
      qb.getOne.mockResolvedValue({ id: 'ap-0', inicio: emUma(24) });
      await expect(svc.create(WS, USER, base())).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('procura conflito só na agenda do profissional, não do workspace', async () => {
      await svc.create(WS, USER, { ...base(), profissionalId: 'nutri-2' });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'a.profissional_id = :profissionalId', { profissionalId: 'nutri-2' },
      );
    });

    it('ignora consultas canceladas ao procurar conflito', async () => {
      await svc.create(WS, USER, base());
      const chamada = qb.andWhere.mock.calls.find((c: any[]) => c[0].includes('status IN'));
      expect(chamada[1].ocupam).not.toContain('cancelada');
      expect(chamada[1].ocupam).not.toContain('faltou');
    });

    it('compara intervalos por sobreposição, não por igualdade de início', async () => {
      await svc.create(WS, USER, base());
      const chamada = qb.andWhere.mock.calls.find((c: any[]) => c[0].includes('a.inicio <'));
      // encostar não é colidir: início < fim do outro E fim > início do outro
      expect(chamada[0]).toBe('a.inicio < :fim AND a.fim > :inicio');
    });
  });

  describe('mudarStatus', () => {
    it('recusa status fora da lista', async () => {
      repo.findOne.mockResolvedValue({ id: 'ap-1', workspaceId: WS, status: 'agendada', inicio: hoursAgo(2) });
      await expect(svc.mudarStatus(WS, USER, 'ap-1', 'remarcada'))
        .rejects.toThrow(BadRequestException);
    });

    it('não marca presença em consulta que ainda não aconteceu', async () => {
      repo.findOne.mockResolvedValue({ id: 'ap-1', workspaceId: WS, status: 'agendada', inicio: emUma(3) });
      await expect(svc.mudarStatus(WS, USER, 'ap-1', 'realizada'))
        .rejects.toThrow(BadRequestException);
    });

    it('não marca falta em consulta futura', async () => {
      repo.findOne.mockResolvedValue({ id: 'ap-1', workspaceId: WS, status: 'agendada', inicio: emUma(3) });
      await expect(svc.mudarStatus(WS, USER, 'ap-1', 'faltou'))
        .rejects.toThrow(BadRequestException);
    });

    it('aceita presença depois do horário', async () => {
      repo.findOne.mockResolvedValue({ id: 'ap-1', workspaceId: WS, status: 'confirmada', inicio: hoursAgo(2) });
      await svc.mudarStatus(WS, USER, 'ap-1', 'realizada');
      expect(repo.update).toHaveBeenCalledWith('ap-1', { status: 'realizada' });
    });

    it('confirma consulta futura normalmente', async () => {
      repo.findOne.mockResolvedValue({ id: 'ap-1', workspaceId: WS, status: 'agendada', inicio: emUma(24) });
      await svc.mudarStatus(WS, USER, 'ap-1', 'confirmada');
      expect(repo.update).toHaveBeenCalledWith('ap-1', { status: 'confirmada' });
    });

    it('guarda o motivo ao cancelar, sem espaços das bordas', async () => {
      repo.findOne.mockResolvedValue({ id: 'ap-1', workspaceId: WS, status: 'agendada', inicio: emUma(24) });
      await svc.mudarStatus(WS, USER, 'ap-1', 'cancelada', '  paciente pediu  ');
      expect(repo.update).toHaveBeenCalledWith('ap-1', {
        status: 'cancelada', motivoCancelamento: 'paciente pediu',
      });
    });

    it('cancelamento sem motivo grava nulo, não string vazia', async () => {
      repo.findOne.mockResolvedValue({ id: 'ap-1', workspaceId: WS, status: 'agendada', inicio: emUma(24) });
      await svc.mudarStatus(WS, USER, 'ap-1', 'cancelada', '   ');
      expect(repo.update).toHaveBeenCalledWith('ap-1', {
        status: 'cancelada', motivoCancelamento: null,
      });
    });

    it('consulta cancelada não muda de status', async () => {
      repo.findOne.mockResolvedValue({ id: 'ap-1', workspaceId: WS, status: 'cancelada', inicio: hoursAgo(2) });
      await expect(svc.mudarStatus(WS, USER, 'ap-1', 'realizada'))
        .rejects.toThrow(BadRequestException);
    });

    it('não acha consulta de outro workspace', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.mudarStatus(WS, USER, 'ap-1', 'confirmada'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('recusa alterar consulta cancelada', async () => {
      repo.findOne.mockResolvedValue({ id: 'ap-1', workspaceId: WS, status: 'cancelada' });
      await expect(svc.update(WS, USER, 'ap-1', { observacoes: 'x' }))
        .rejects.toThrow(BadRequestException);
    });

    it('ao remarcar, confere conflito ignorando a própria consulta', async () => {
      const inicio = emUma(24);
      repo.findOne.mockResolvedValue({
        id: 'ap-1', workspaceId: WS, status: 'agendada', profissionalId: 'nutri-1',
        inicio, fim: new Date(inicio.getTime() + 60 * 60_000),
      });
      await svc.update(WS, USER, 'ap-1', { inicio: emUma(48).toISOString() });
      expect(qb.andWhere).toHaveBeenCalledWith('a.id <> :ignorarId', { ignorarId: 'ap-1' });
    });

    it('preserva a duração quando só o início muda', async () => {
      const inicio = emUma(24);
      repo.findOne.mockResolvedValue({
        id: 'ap-1', workspaceId: WS, status: 'agendada', profissionalId: 'n1',
        inicio, fim: new Date(inicio.getTime() + 90 * 60_000),
      });
      await svc.update(WS, USER, 'ap-1', { inicio: emUma(48).toISOString() });
      const m = repo.update.mock.calls[0][1];
      expect(m.fim.getTime() - m.inicio.getTime()).toBe(90 * 60_000);
    });
  });

  describe('listar', () => {
    it('recusa intervalo invertido', async () => {
      await expect(svc.listar(WS, { de: '2026-09-10', ate: '2026-09-01' }))
        .rejects.toThrow(BadRequestException);
    });

    it('recusa data inválida', async () => {
      await expect(svc.listar(WS, { de: 'qualquer coisa' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('horariosLivres', () => {
    it('não oferece horário já ocupado', async () => {
      const amanha = new Date(Date.now() + 864e5);
      amanha.setHours(10, 0, 0, 0);
      repo.find.mockResolvedValue([
        { inicio: amanha, fim: new Date(amanha.getTime() + 60 * 60_000), status: 'agendada' },
      ]);
      const livres = await svc.horariosLivres(WS, 'n1', amanha.toISOString(), 60);
      const ocupado = livres.some((h) => new Date(h).getHours() === 10 && new Date(h).getMinutes() === 0);
      expect(ocupado).toBe(false);
    });

    it('não oferece horário que já passou', async () => {
      repo.find.mockResolvedValue([]);
      const livres = await svc.horariosLivres(WS, 'n1', new Date().toISOString(), 60);
      expect(livres.every((h) => new Date(h) > new Date())).toBe(true);
    });

    it('recusa data inválida', async () => {
      await expect(svc.horariosLivres(WS, 'n1', 'amanhã')).rejects.toThrow(BadRequestException);
    });
  });
});
