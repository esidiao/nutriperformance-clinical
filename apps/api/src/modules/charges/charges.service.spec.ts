import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChargesService } from './charges.service';
import { Charge } from './charge.entity';
import { AuditService } from '../audit/audit.service';

const WS = 'ws-1';
const USER = 'user-1';

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) =>
  new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const daquiADias = (n: number) =>
  new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const pendente = (over: Partial<Charge> = {}): any => ({
  id: 'ch-1', workspaceId: WS, patientId: 'p-1', appointmentId: null,
  profissionalId: USER, createdBy: USER, descricao: 'Consulta',
  valorCentavos: 20000, valorPagoCentavos: null, status: 'pendente',
  vencimento: hoje(), pagoEm: null, formaPagamento: null,
  observacoes: null, motivoCancelamento: null, ...over,
});

describe('ChargesService', () => {
  let svc: ChargesService;
  let repo: any;
  let audit: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => ({ id: 'ch-1', ...d })),
      find: jest.fn(async () => []),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(async () => ({ id: 'ch-1' })),
      update: jest.fn(),
    };
    audit = { log: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        ChargesService,
        { provide: getRepositoryToken(Charge), useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    svc = mod.get(ChargesService);
  });

  // ── Dinheiro ──────────────────────────────────────────────────────────────
  describe('valores', () => {
    it('converte reais para centavos arredondando, não truncando', async () => {
      // 19.99 * 100 dá 1998.9999999999998 em ponto flutuante. Truncar cobraria
      // R$ 19,98 — um centavo a menos, em toda consulta.
      const r = await svc.create(WS, USER, { patientId: 'p-1', descricao: 'Consulta', valor: 19.99 });
      expect(r.valorCentavos).toBe(1999);
    });

    it('aceita centavos direto', async () => {
      const r = await svc.create(WS, USER, {
        patientId: 'p-1', descricao: 'Consulta', valorCentavos: 15000,
      });
      expect(r.valorCentavos).toBe(15000);
    });

    it('recusa centavos fracionários', async () => {
      await expect(svc.create(WS, USER, {
        patientId: 'p-1', descricao: 'x', valorCentavos: 100.5,
      })).rejects.toThrow(BadRequestException);
    });

    it('recusa valor absurdo — provável real digitado como centavo', async () => {
      await expect(svc.create(WS, USER, {
        patientId: 'p-1', descricao: 'x', valorCentavos: 99_999_999,
      })).rejects.toThrow(/alto demais/);
    });

    it('recusa valor zero e aponta a isenção como caminho', async () => {
      await expect(svc.create(WS, USER, {
        patientId: 'p-1', descricao: 'x', valor: 0,
      })).rejects.toThrow(/isento/);
    });

    it('recusa valor não numérico', async () => {
      await expect(svc.create(WS, USER, {
        patientId: 'p-1', descricao: 'x', valor: 'abc',
      })).rejects.toThrow(BadRequestException);
    });
  });

  // ── Criação ───────────────────────────────────────────────────────────────
  describe('create', () => {
    it('exige paciente', async () => {
      await expect(svc.create(WS, USER, { descricao: 'x', valor: 10 }))
        .rejects.toThrow(/patientId/);
    });

    it('exige descrição não vazia', async () => {
      await expect(svc.create(WS, USER, { patientId: 'p-1', descricao: '   ', valor: 10 }))
        .rejects.toThrow(/Descrição/);
    });

    it('vencimento padrão é hoje', async () => {
      const r = await svc.create(WS, USER, { patientId: 'p-1', descricao: 'x', valor: 10 });
      expect(r.vencimento).toBe(hoje());
    });

    it('recusa vencimento em formato inválido', async () => {
      await expect(svc.create(WS, USER, {
        patientId: 'p-1', descricao: 'x', valor: 10, vencimento: '31/12/2026',
      })).rejects.toThrow(/AAAA-MM-DD/);
    });

    it('nasce pendente e sem recebimento', async () => {
      const r = await svc.create(WS, USER, { patientId: 'p-1', descricao: 'x', valor: 10 });
      expect(r.status).toBe('pendente');
      expect(r.valorPagoCentavos).toBeNull();
      expect(r.pagoEm).toBeNull();
    });

    it('a receita é de quem atende, não de quem lança', async () => {
      const r = await svc.create(WS, 'secretaria', {
        patientId: 'p-1', descricao: 'x', valor: 10, profissionalId: 'nutri-2',
      });
      expect(r.profissionalId).toBe('nutri-2');
      expect(r.createdBy).toBe('secretaria');
    });

    it('registra auditoria', async () => {
      await svc.create(WS, USER, { patientId: 'p-1', descricao: 'x', valor: 10 });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE', resource: 'charges',
      }));
    });
  });

  // ── Recebimento ───────────────────────────────────────────────────────────
  describe('pagar', () => {
    it('exige forma de pagamento', async () => {
      repo.findOne.mockResolvedValue(pendente());
      await expect(svc.pagar(WS, USER, 'ch-1', {})).rejects.toThrow(/Forma de pagamento/);
    });

    it('recusa forma inexistente', async () => {
      repo.findOne.mockResolvedValue(pendente());
      await expect(svc.pagar(WS, USER, 'ch-1', { formaPagamento: 'bitcoin' }))
        .rejects.toThrow(/Forma de pagamento/);
    });

    it('recebe o valor cheio por padrão', async () => {
      repo.findOne.mockResolvedValue(pendente());
      await svc.pagar(WS, USER, 'ch-1', { formaPagamento: 'pix' });
      expect(repo.update).toHaveBeenCalledWith('ch-1', expect.objectContaining({
        status: 'pago', valorPagoCentavos: 20000, formaPagamento: 'pix',
      }));
    });

    it('aceita recebimento parcial ou com desconto', async () => {
      repo.findOne.mockResolvedValue(pendente());
      await svc.pagar(WS, USER, 'ch-1', { formaPagamento: 'dinheiro', valor: 150 });
      expect(repo.update).toHaveBeenCalledWith('ch-1', expect.objectContaining({
        valorPagoCentavos: 15000,
      }));
    });

    it('recusa receber mais do que foi cobrado', async () => {
      repo.findOne.mockResolvedValue(pendente());
      await expect(svc.pagar(WS, USER, 'ch-1', { formaPagamento: 'pix', valor: 500 }))
        .rejects.toThrow(/maior que o cobrado/);
    });

    it('não recebe duas vezes', async () => {
      repo.findOne.mockResolvedValue(pendente({ status: 'pago', pagoEm: new Date() }));
      await expect(svc.pagar(WS, USER, 'ch-1', { formaPagamento: 'pix' }))
        .rejects.toThrow(/já foi recebido/);
    });

    it('não recebe lançamento cancelado', async () => {
      repo.findOne.mockResolvedValue(pendente({ status: 'cancelado' }));
      await expect(svc.pagar(WS, USER, 'ch-1', { formaPagamento: 'pix' }))
        .rejects.toThrow(/cancelado/);
    });

    it('recusa data de recebimento no futuro', async () => {
      repo.findOne.mockResolvedValue(pendente());
      await expect(svc.pagar(WS, USER, 'ch-1', {
        formaPagamento: 'pix', pagoEm: new Date(Date.now() + 864e5).toISOString(),
      })).rejects.toThrow(/futuro/);
    });

    it('aceita registrar recebimento de data passada', async () => {
      repo.findOne.mockResolvedValue(pendente());
      const ontem = new Date(Date.now() - 864e5);
      await svc.pagar(WS, USER, 'ch-1', { formaPagamento: 'dinheiro', pagoEm: ontem.toISOString() });
      expect(repo.update).toHaveBeenCalledWith('ch-1', expect.objectContaining({ status: 'pago' }));
    });
  });

  // ── Isenção ───────────────────────────────────────────────────────────────
  describe('isentar', () => {
    it('zera o recebido: gratuito não é receita', async () => {
      repo.findOne.mockResolvedValue(pendente());
      await svc.isentar(WS, USER, 'ch-1', 'Atendimento social');
      expect(repo.update).toHaveBeenCalledWith('ch-1', expect.objectContaining({
        status: 'isento', valorPagoCentavos: 0,
      }));
    });

    it('não isenta o que já foi recebido', async () => {
      repo.findOne.mockResolvedValue(pendente({ status: 'pago' }));
      await expect(svc.isentar(WS, USER, 'ch-1', 'x')).rejects.toThrow(BadRequestException);
    });
  });

  // ── Cancelamento ──────────────────────────────────────────────────────────
  describe('cancelar', () => {
    it('exige motivo', async () => {
      repo.findOne.mockResolvedValue(pendente());
      await expect(svc.cancelar(WS, USER, 'ch-1', '  ')).rejects.toThrow(/motivo/);
    });

    it('não cancela recebido — manda registrar estorno', async () => {
      repo.findOne.mockResolvedValue(pendente({ status: 'pago' }));
      await expect(svc.cancelar(WS, USER, 'ch-1', 'erro')).rejects.toThrow(/estorno/);
    });

    it('grava o motivo', async () => {
      repo.findOne.mockResolvedValue(pendente());
      await svc.cancelar(WS, USER, 'ch-1', 'Paciente desistiu');
      expect(repo.update).toHaveBeenCalledWith('ch-1', {
        status: 'cancelado', motivoCancelamento: 'Paciente desistiu',
      });
    });
  });

  // ── Edição ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('só edita pendente', async () => {
      repo.findOne.mockResolvedValue(pendente({ status: 'pago' }));
      await expect(svc.update(WS, USER, 'ch-1', { valor: 300 })).rejects.toThrow(/pendente/);
    });

    it('não grava nada quando não há mudança', async () => {
      repo.findOne.mockResolvedValue(pendente());
      await svc.update(WS, USER, 'ch-1', {});
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('404 para lançamento de outro workspace', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.update(WS, USER, 'ch-x', { valor: 1 })).rejects.toThrow(NotFoundException);
    });
  });

  // ── Resumo ────────────────────────────────────────────────────────────────
  describe('resumo', () => {
    it('vencido sai do vencimento, não de status gravado', async () => {
      repo.find.mockResolvedValue([
        pendente({ id: 'a', vencimento: diasAtras(5), valorCentavos: 10000 }),
        pendente({ id: 'b', vencimento: daquiADias(5), valorCentavos: 30000 }),
      ]);
      const r = await svc.resumo(WS, {});
      expect(r.aReceberCentavos).toBe(40000);
      expect(r.vencidoCentavos).toBe(10000);
      expect(r.vencidoQtd).toBe(1);
    });

    it('recebido no mês usa o valor recebido, não o cobrado', async () => {
      repo.find.mockResolvedValue([
        pendente({ status: 'pago', valorCentavos: 20000, valorPagoCentavos: 15000, pagoEm: new Date() }),
      ]);
      const r = await svc.resumo(WS, {});
      expect(r.recebidoNoMesCentavos).toBe(15000);
    });

    it('isento não entra na receita', async () => {
      repo.find.mockResolvedValue([
        pendente({ status: 'isento', valorCentavos: 20000, valorPagoCentavos: 0 }),
      ]);
      const r = await svc.resumo(WS, {});
      expect(r.recebidoNoMesCentavos).toBe(0);
      expect(r.isentoNoMesCentavos).toBe(20000);
    });

    it('cancelado não conta como a receber', async () => {
      repo.find.mockResolvedValue([
        pendente({ status: 'cancelado', valorCentavos: 20000 }),
      ]);
      const r = await svc.resumo(WS, {});
      expect(r.aReceberCentavos).toBe(0);
    });

    it('soma de centavos fecha exata', async () => {
      // Três consultas de R$ 19,99. Em ponto flutuante, 19.99*3 = 59.97000000000001.
      repo.find.mockResolvedValue([
        pendente({ valorCentavos: 1999 }),
        pendente({ valorCentavos: 1999 }),
        pendente({ valorCentavos: 1999 }),
      ]);
      const r = await svc.resumo(WS, {});
      expect(r.aReceberCentavos).toBe(5997);
    });
  });

  // ── Listagem ──────────────────────────────────────────────────────────────
  describe('listar', () => {
    it('recusa status inexistente', async () => {
      await expect(svc.listar(WS, { status: 'quitado' })).rejects.toThrow(/Status inválido/);
    });

    it('recusa intervalo invertido', async () => {
      await expect(svc.listar(WS, { de: '2026-12-01', ate: '2026-01-01' }))
        .rejects.toThrow(/anterior/);
    });
  });
});
