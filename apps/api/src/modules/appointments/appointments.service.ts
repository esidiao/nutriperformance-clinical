import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not, In } from 'typeorm';
import { Appointment } from './appointment.entity';
import { AuditService } from '../audit/audit.service';
import {
  gerarSala, validarLinkVideo, linkDisponivel, ORIGENS,
} from './telessaude';

export const TIPOS = ['primeira_consulta', 'retorno', 'avaliacao', 'online'] as const;
export const STATUS = ['agendada', 'confirmada', 'realizada', 'faltou', 'cancelada'] as const;

/** Status que ainda ocupam a agenda. Cancelada e falta liberam o horario. */
const OCUPAM_HORARIO = ['agendada', 'confirmada', 'realizada'];

const DURACAO_PADRAO_MIN = 60;
const DURACAO_MAX_MIN = 8 * 60;

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment) private readonly repo: Repository<Appointment>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Consulta que se sobrepoe a outra do mesmo profissional.
   *
   * Dois intervalos colidem quando um comeca antes do outro terminar e termina
   * depois de o outro comecar. Encostar nao e colidir: uma consulta que termina
   * as 15h nao conflita com outra que comeca as 15h.
   */
  private async conflito(
    workspaceId: string, profissionalId: string, inicio: Date, fim: Date, ignorarId?: string,
  ): Promise<Appointment | null> {
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.workspace_id = :workspaceId', { workspaceId })
      .andWhere('a.profissional_id = :profissionalId', { profissionalId })
      .andWhere('a.status IN (:...ocupam)', { ocupam: OCUPAM_HORARIO })
      .andWhere('a.inicio < :fim AND a.fim > :inicio', { inicio, fim });

    if (ignorarId) qb.andWhere('a.id <> :ignorarId', { ignorarId });
    return qb.getOne();
  }

  private validarJanela(inicioISO: unknown, duracaoMin: unknown) {
    const inicio = new Date(String(inicioISO));
    if (Number.isNaN(inicio.getTime())) {
      throw new BadRequestException('Data e hora de início inválidas');
    }

    const dur = Number(duracaoMin ?? DURACAO_PADRAO_MIN);
    if (!Number.isFinite(dur) || dur <= 0) {
      throw new BadRequestException('Duração deve ser maior que zero');
    }
    if (dur > DURACAO_MAX_MIN) {
      throw new BadRequestException('Duração acima de 8 horas — verifique o horário informado');
    }

    return { inicio, fim: new Date(inicio.getTime() + dur * 60_000) };
  }

  async create(workspaceId: string, userId: string, dto: any): Promise<Appointment> {
    if (!dto?.patientId) throw new BadRequestException('patientId é obrigatório');

    const tipo = dto.tipo ?? 'retorno';
    if (!TIPOS.includes(tipo)) {
      throw new BadRequestException(`Tipo inválido. Use um de: ${TIPOS.join(', ')}`);
    }

    const { inicio, fim } = this.validarJanela(dto.inicio, dto.duracaoMin);

    // Quem atende e quem agenda podem ser pessoas diferentes: a secretaria
    // marca na agenda da nutricionista.
    const profissionalId = dto.profissionalId ?? userId;

    const choque = await this.conflito(workspaceId, profissionalId, inicio, fim);
    if (choque) {
      throw new ConflictException(
        `Já existe consulta neste horário (${new Date(choque.inicio).toLocaleString('pt-BR')}). `
        + 'Escolha outro horário ou cancele a anterior.',
      );
    }

    const entity = this.repo.create({
      workspaceId,
      patientId: dto.patientId,
      profissionalId,
      createdBy: userId,
      inicio,
      fim,
      tipo,
      status: 'agendada',
      observacoes: dto.observacoes ?? null,
    });

    const saved = await this.repo.save(entity);
    this.auditService.log({
      userId, workspaceId, action: 'CREATE', resource: 'appointments', resourceId: saved.id,
    });
    return saved;
  }

  /** Consultas num intervalo. O padrao e a semana corrente. */
  async listar(
    workspaceId: string,
    filtros: { de?: string; ate?: string; profissionalId?: string; patientId?: string },
  ): Promise<Appointment[]> {
    const de = filtros.de ? new Date(filtros.de) : new Date();
    const ate = filtros.ate ? new Date(filtros.ate) : new Date(de.getTime() + 7 * 864e5);

    if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) {
      throw new BadRequestException('Intervalo de datas inválido');
    }
    if (ate < de) throw new BadRequestException('A data final é anterior à inicial');

    const where: any = { workspaceId, inicio: Between(de, ate) };
    if (filtros.profissionalId) where.profissionalId = filtros.profissionalId;
    if (filtros.patientId) where.patientId = filtros.patientId;

    return this.repo.find({ where, order: { inicio: 'ASC' }, take: 500 });
  }

  async findOne(workspaceId: string, id: string): Promise<Appointment> {
    const a = await this.repo.findOne({ where: { id, workspaceId } });
    if (!a) throw new NotFoundException('Consulta não encontrada');
    return a;
  }

  async update(workspaceId: string, userId: string, id: string, dto: any): Promise<Appointment> {
    const atual = await this.findOne(workspaceId, id);

    if (atual.status === 'cancelada') {
      throw new BadRequestException('Consulta cancelada não pode ser alterada. Crie uma nova.');
    }

    const mudancas: Partial<Appointment> = {};

    if (dto.inicio !== undefined || dto.duracaoMin !== undefined) {
      const duracaoAtual = (new Date(atual.fim).getTime() - new Date(atual.inicio).getTime()) / 60_000;
      const { inicio, fim } = this.validarJanela(
        dto.inicio ?? atual.inicio.toISOString(),
        dto.duracaoMin ?? duracaoAtual,
      );
      const choque = await this.conflito(workspaceId, atual.profissionalId, inicio, fim, id);
      if (choque) {
        throw new ConflictException('Já existe consulta neste horário para este profissional.');
      }
      mudancas.inicio = inicio;
      mudancas.fim = fim;
    }

    if (dto.tipo !== undefined) {
      if (!TIPOS.includes(dto.tipo)) throw new BadRequestException('Tipo inválido');
      mudancas.tipo = dto.tipo;
    }
    if (dto.observacoes !== undefined) mudancas.observacoes = dto.observacoes;

    if (Object.keys(mudancas).length === 0) return atual;

    await this.repo.update(id, mudancas);
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'appointments',
      resourceId: id, changes: mudancas,
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  /**
   * Muda o status. "Realizada" e "faltou" so valem depois da hora marcada:
   * marcar presenca em consulta futura seria registro falso no prontuario.
   */
  async mudarStatus(
    workspaceId: string, userId: string, id: string, status: string, motivo?: string,
  ): Promise<Appointment> {
    if (!STATUS.includes(status as any)) {
      throw new BadRequestException(`Status inválido. Use um de: ${STATUS.join(', ')}`);
    }

    const atual = await this.findOne(workspaceId, id);

    if (atual.status === 'cancelada' && status !== 'agendada') {
      throw new BadRequestException('Consulta cancelada não muda de status. Crie uma nova.');
    }

    if ((status === 'realizada' || status === 'faltou') && new Date(atual.inicio) > new Date()) {
      throw new BadRequestException(
        'A consulta ainda não aconteceu — não é possível marcar como realizada ou como falta.',
      );
    }

    const mudancas: Partial<Appointment> = { status };
    if (status === 'cancelada') mudancas.motivoCancelamento = motivo?.trim() || null;

    await this.repo.update(id, mudancas);
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'appointments',
      resourceId: id, changes: mudancas,
    });
    return this.repo.findOneOrFail({ where: { id } });
  }


  // ── Telessaúde (lacuna 13) ────────────────────────────────────────────────

  /**
   * Define a sala da consulta online.
   *
   * Sem `link`, gera uma sala nova. Com `link`, usa o da profissional — ela
   * pode preferir a ferramenta que já domina, e obrigar a usar a nossa seria
   * pior para o atendimento.
   */
  async definirSala(
    workspaceId: string, userId: string, id: string, dto: any,
  ): Promise<Appointment> {
    const atual = await this.findOne(workspaceId, id);

    if (atual.tipo !== 'online') {
      throw new BadRequestException(
        'Sala de vídeo só faz sentido em consulta online. Mude o tipo da consulta primeiro.',
      );
    }
    if (atual.status === 'cancelada') {
      throw new BadRequestException('Consulta cancelada não recebe sala.');
    }

    const proprio = dto?.link !== undefined && dto?.link !== null && dto?.link !== '';
    const mudancas: Partial<Appointment> = proprio
      ? { linkVideo: validarLinkVideo(dto.link), videoOrigem: 'proprio' }
      : { linkVideo: gerarSala(), videoOrigem: 'gerado' };

    await this.repo.update(id, mudancas);
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'appointments',
      resourceId: id, changes: { videoOrigem: mudancas.videoOrigem },
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  async removerSala(workspaceId: string, userId: string, id: string): Promise<Appointment> {
    await this.findOne(workspaceId, id);
    await this.repo.update(id, { linkVideo: null, videoOrigem: null });
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'appointments', resourceId: id,
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  /**
   * Consultas online do paciente com o link JÁ FILTRADO pela janela de tempo.
   *
   * O filtro mora aqui, e não na tela, porque a tela não é barreira: quem
   * abrisse a resposta da API veria o link mesmo com o botão escondido.
   */
  async paraPortal(workspaceId: string, patientId: string, de: string, ate: string) {
    const consultas = await this.listar(workspaceId, { de, ate, patientId });
    const agora = new Date();

    return consultas
      .filter((c) => c.status === 'agendada' || c.status === 'confirmada')
      .map((c) => {
        const disponivel = c.tipo === 'online' && !!c.linkVideo
          && linkDisponivel(c.inicio, c.fim, agora);
        return {
          inicio: c.inicio,
          fim: c.fim,
          tipo: c.tipo,
          status: c.status,
          // Só existe se for online E estiver na janela.
          linkVideo: disponivel ? c.linkVideo : null,
          // Sinaliza que HAVERÁ sala, sem entregar o link antes da hora — a
          // pessoa precisa saber que a consulta é por vídeo ao se organizar.
          temSalaMarcada: c.tipo === 'online' && !!c.linkVideo,
        };
      });
  }

  /**
   * Horarios livres num dia, em passos de 30 min dentro do expediente.
   * Serve a tela de agendamento: em vez de tentar e tomar erro de conflito, a
   * profissional ve o que esta livre.
   */
  async horariosLivres(
    workspaceId: string, profissionalId: string, dia: string, duracaoMin = DURACAO_PADRAO_MIN,
  ): Promise<string[]> {
    const base = new Date(dia);
    if (Number.isNaN(base.getTime())) throw new BadRequestException('Data inválida');

    const inicioDia = new Date(base); inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(base); fimDia.setHours(23, 59, 59, 999);

    const ocupadas = await this.repo.find({
      where: {
        workspaceId, profissionalId,
        inicio: Between(inicioDia, fimDia),
        status: Not(In(['cancelada'])),
      },
    });

    const livres: string[] = [];
    for (let h = 7; h < 20; h++) {
      for (const m of [0, 30]) {
        const ini = new Date(base); ini.setHours(h, m, 0, 0);
        const fim = new Date(ini.getTime() + duracaoMin * 60_000);
        if (ini < new Date()) continue;               // horario ja passou
        const colide = ocupadas.some(
          (o) => new Date(o.inicio) < fim && new Date(o.fim) > ini,
        );
        if (!colide) livres.push(ini.toISOString());
      }
    }
    return livres;
  }
}
