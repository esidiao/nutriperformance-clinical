import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Charge } from './charge.entity';
import { AuditService } from '../audit/audit.service';

export const STATUS = ['pendente', 'pago', 'isento', 'cancelado'] as const;
export const FORMAS = [
  'dinheiro', 'pix', 'debito', 'credito', 'transferencia', 'convenio', 'outro',
] as const;

/** Um lançamento de R$ 100.000 quase sempre é centavo digitado como real. */
const VALOR_MAX_CENTAVOS = 10_000_000;

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Data (sem hora) em ISO. */
const hoje = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class ChargesService {
  constructor(
    @InjectRepository(Charge) private readonly repo: Repository<Charge>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Aceita valor em centavos (`valorCentavos`) ou em reais (`valor`).
   *
   * A conversão de reais usa Math.round e não truncamento: 19.99 chega do
   * JavaScript como 1998.9999999999998, e truncar cobraria R$ 19,98 do
   * paciente. É o erro de um centavo que ninguém percebe até o fechamento do
   * mês não bater.
   */
  private normalizarValor(dto: any, campoCentavos = 'valorCentavos', campoReais = 'valor'): number {
    const bruto = dto?.[campoCentavos] !== undefined
      ? Number(dto[campoCentavos])
      : Math.round(Number(dto?.[campoReais]) * 100);

    if (!Number.isFinite(bruto)) throw new BadRequestException('Valor inválido');
    if (!Number.isInteger(bruto)) throw new BadRequestException('Valor em centavos deve ser inteiro');
    if (bruto > VALOR_MAX_CENTAVOS) {
      throw new BadRequestException(
        `Valor de ${brl(bruto)} parece alto demais — confira se digitou reais no campo de centavos.`,
      );
    }
    return bruto;
  }

  async create(workspaceId: string, userId: string, dto: any): Promise<Charge> {
    if (!dto?.patientId) throw new BadRequestException('patientId é obrigatório');
    if (!dto?.descricao?.trim()) throw new BadRequestException('Descrição é obrigatória');

    const valorCentavos = this.normalizarValor(dto);
    if (valorCentavos <= 0) {
      throw new BadRequestException(
        'Valor deve ser maior que zero. Para atendimento gratuito, registre o valor e marque como '
        + 'isento — assim o gratuito não vira receita recebida no fechamento.',
      );
    }

    const vencimento = String(dto.vencimento ?? hoje()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento) || Number.isNaN(new Date(vencimento).getTime())) {
      throw new BadRequestException('Vencimento inválido — use o formato AAAA-MM-DD');
    }

    const entity = this.repo.create({
      workspaceId,
      patientId: dto.patientId,
      appointmentId: dto.appointmentId ?? null,
      profissionalId: dto.profissionalId ?? userId,
      createdBy: userId,
      descricao: dto.descricao.trim(),
      valorCentavos,
      valorPagoCentavos: null,
      status: 'pendente',
      vencimento,
      pagoEm: null,
      formaPagamento: null,
      observacoes: dto.observacoes ?? null,
    });

    const saved = await this.repo.save(entity);
    this.auditService.log({
      userId, workspaceId, action: 'CREATE', resource: 'charges', resourceId: saved.id,
    });
    return saved;
  }

  async listar(
    workspaceId: string,
    filtros: { status?: string; patientId?: string; profissionalId?: string; de?: string; ate?: string },
  ): Promise<Charge[]> {
    const where: any = { workspaceId };

    if (filtros.status) {
      if (!STATUS.includes(filtros.status as any)) {
        throw new BadRequestException(`Status inválido. Use um de: ${STATUS.join(', ')}`);
      }
      where.status = filtros.status;
    }
    if (filtros.patientId) where.patientId = filtros.patientId;
    if (filtros.profissionalId) where.profissionalId = filtros.profissionalId;

    if (filtros.de || filtros.ate) {
      const de = (filtros.de ?? '1900-01-01').slice(0, 10);
      const ate = (filtros.ate ?? '2999-12-31').slice(0, 10);
      if (ate < de) throw new BadRequestException('A data final é anterior à inicial');
      where.vencimento = Between(de, ate);
    }

    return this.repo.find({ where, order: { vencimento: 'DESC' }, take: 500 });
  }

  async findOne(workspaceId: string, id: string): Promise<Charge> {
    const c = await this.repo.findOne({ where: { id, workspaceId } });
    if (!c) throw new NotFoundException('Lançamento não encontrado');
    return c;
  }

  /**
   * Registra o recebimento.
   *
   * Não deixa receber duas vezes nem receber o que foi cancelado, e recusa data
   * futura: "recebido amanhã" infla o caixa de hoje com dinheiro que não entrou.
   */
  async pagar(workspaceId: string, userId: string, id: string, dto: any): Promise<Charge> {
    const atual = await this.findOne(workspaceId, id);

    if (atual.status === 'pago') {
      throw new BadRequestException(
        `Este lançamento já foi recebido em ${new Date(atual.pagoEm!).toLocaleDateString('pt-BR')}.`,
      );
    }
    if (atual.status === 'cancelado') {
      throw new BadRequestException('Lançamento cancelado não pode ser recebido. Crie um novo.');
    }

    const forma = dto?.formaPagamento;
    if (!forma || !FORMAS.includes(forma)) {
      throw new BadRequestException(
        `Forma de pagamento obrigatória. Use uma de: ${FORMAS.join(', ')}`,
      );
    }

    // Aceita as quatro grafias de propósito. Lendo só `valorPago`, um cliente
    // que mandasse `valor: 150` teria o campo ignorado em silêncio e os R$ 200
    // cheios gravados como recebidos — dinheiro errado no fechamento, sem erro
    // na tela. Numa rota de recebimento não existe outro sentido para "valor".
    const informou = ['valorPagoCentavos', 'valorPago', 'valorCentavos', 'valor']
      .find((c) => dto?.[c] !== undefined);

    const valorPagoCentavos = informou
      ? this.normalizarValor(
          dto,
          informou.endsWith('Centavos') ? informou : '__ausente__',
          informou.endsWith('Centavos') ? '__ausente__' : informou,
        )
      : atual.valorCentavos;

    if (valorPagoCentavos <= 0) throw new BadRequestException('Valor recebido deve ser maior que zero');
    if (valorPagoCentavos > atual.valorCentavos) {
      throw new BadRequestException(
        `Recebido (${brl(valorPagoCentavos)}) é maior que o cobrado (${brl(atual.valorCentavos)}). `
        + 'Corrija o valor do lançamento antes de registrar o recebimento.',
      );
    }

    const pagoEm = dto?.pagoEm ? new Date(dto.pagoEm) : new Date();
    if (Number.isNaN(pagoEm.getTime())) throw new BadRequestException('Data de recebimento inválida');
    if (pagoEm.getTime() > Date.now()) {
      throw new BadRequestException('Data de recebimento no futuro — o dinheiro ainda não entrou.');
    }

    const mudancas: Partial<Charge> = {
      status: 'pago', valorPagoCentavos, formaPagamento: forma, pagoEm,
    };
    await this.repo.update(id, mudancas);
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'charges', resourceId: id, changes: mudancas,
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  /** Isenta o lançamento. Distinto de pago: gratuito não é receita. */
  async isentar(workspaceId: string, userId: string, id: string, motivo?: string): Promise<Charge> {
    const atual = await this.findOne(workspaceId, id);
    if (atual.status === 'pago') {
      throw new BadRequestException('Lançamento já recebido não pode virar isento.');
    }
    if (atual.status === 'cancelado') {
      throw new BadRequestException('Lançamento cancelado não pode virar isento.');
    }

    const mudancas: Partial<Charge> = {
      status: 'isento', valorPagoCentavos: 0, observacoes: motivo?.trim() || atual.observacoes,
    };
    await this.repo.update(id, mudancas);
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'charges', resourceId: id, changes: mudancas,
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  /**
   * Cancela. Não existe exclusão: apagar lançamento destrói a trilha do
   * faturamento, e é exatamente o registro que alguém quereria sumir.
   */
  async cancelar(workspaceId: string, userId: string, id: string, motivo?: string): Promise<Charge> {
    const atual = await this.findOne(workspaceId, id);

    if (atual.status === 'pago') {
      throw new BadRequestException(
        'Lançamento já recebido não pode ser cancelado. Registre um estorno como novo lançamento.',
      );
    }
    if (!motivo?.trim()) {
      throw new BadRequestException('Informe o motivo do cancelamento.');
    }

    const mudancas: Partial<Charge> = { status: 'cancelado', motivoCancelamento: motivo.trim() };
    await this.repo.update(id, mudancas);
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'charges', resourceId: id, changes: mudancas,
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  async update(workspaceId: string, userId: string, id: string, dto: any): Promise<Charge> {
    const atual = await this.findOne(workspaceId, id);
    if (atual.status !== 'pendente') {
      throw new BadRequestException(
        'Só lançamento pendente pode ser editado. Recebido, isento e cancelado são histórico.',
      );
    }

    const mudancas: Partial<Charge> = {};
    if (dto.descricao !== undefined) {
      if (!dto.descricao.trim()) throw new BadRequestException('Descrição não pode ficar vazia');
      mudancas.descricao = dto.descricao.trim();
    }
    if (dto.valor !== undefined || dto.valorCentavos !== undefined) {
      const v = this.normalizarValor(dto);
      if (v <= 0) throw new BadRequestException('Valor deve ser maior que zero');
      mudancas.valorCentavos = v;
    }
    if (dto.vencimento !== undefined) {
      const venc = String(dto.vencimento).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(venc)) {
        throw new BadRequestException('Vencimento inválido — use o formato AAAA-MM-DD');
      }
      mudancas.vencimento = venc;
    }
    if (dto.observacoes !== undefined) mudancas.observacoes = dto.observacoes;

    if (Object.keys(mudancas).length === 0) return atual;

    await this.repo.update(id, mudancas);
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'charges', resourceId: id, changes: mudancas,
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  /**
   * Resumo do caixa.
   *
   * "Vencido" é derivado do vencimento na hora da leitura, nunca gravado: um
   * status persistido envelheceria sozinho e mostraria em dia uma conta que
   * venceu ontem.
   */
  async resumo(workspaceId: string, filtros: { profissionalId?: string; mes?: string }) {
    const mes = filtros.mes && /^\d{4}-\d{2}$/.test(filtros.mes)
      ? filtros.mes
      : hoje().slice(0, 7);

    const where: any = { workspaceId };
    if (filtros.profissionalId) where.profissionalId = filtros.profissionalId;

    const todos = await this.repo.find({ where });
    const hojeStr = hoje();

    const soma = (lista: Charge[], campo: 'valorCentavos' | 'valorPagoCentavos') =>
      lista.reduce((t, c) => t + (c[campo] ?? 0), 0);

    const pendentes = todos.filter((c) => c.status === 'pendente');
    const vencidos = pendentes.filter((c) => String(c.vencimento).slice(0, 10) < hojeStr);
    const recebidosNoMes = todos.filter(
      (c) => c.status === 'pago' && c.pagoEm && new Date(c.pagoEm).toISOString().slice(0, 7) === mes,
    );
    const isentosNoMes = todos.filter(
      (c) => c.status === 'isento' && String(c.vencimento).slice(0, 7) === mes,
    );

    return {
      mes,
      aReceberCentavos: soma(pendentes, 'valorCentavos'),
      aReceberQtd: pendentes.length,
      vencidoCentavos: soma(vencidos, 'valorCentavos'),
      vencidoQtd: vencidos.length,
      recebidoNoMesCentavos: soma(recebidosNoMes, 'valorPagoCentavos'),
      recebidoNoMesQtd: recebidosNoMes.length,
      // Isento entra separado, nunca somado à receita: atendimento gratuito
      // inflaria o faturamento se contasse como recebido.
      isentoNoMesCentavos: soma(isentosNoMes, 'valorCentavos'),
      isentoNoMesQtd: isentosNoMes.length,
    };
  }
}
