import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SupervisionRequest } from './supervision-request.entity';
import { AuditService } from '../audit/audit.service';

/** Tipos de trabalho que passam por supervisão. */
export const RECURSOS = [
  'meal_plan', 'nutritional_assessment', 'physical_assessment',
] as const;

export const STATUS = ['pendente', 'aprovado', 'ajustes_solicitados'] as const;

/** O papel que precisa de supervisão. */
export const PAPEL_ESTUDANTE = 'supervised_student';

@Injectable()
export class SupervisionService {
  constructor(
    @InjectRepository(SupervisionRequest)
    private readonly repo: Repository<SupervisionRequest>,
    private readonly auditService: AuditService,
  ) {}

  /** Estagiário pede revisão do próprio trabalho. */
  async solicitar(workspaceId: string, userId: string, dto: any): Promise<SupervisionRequest> {
    const recurso = String(dto?.recurso ?? '');
    if (!RECURSOS.includes(recurso as any)) {
      throw new BadRequestException(`Recurso inválido. Use um de: ${RECURSOS.join(', ')}`);
    }
    if (!dto?.recursoId) throw new BadRequestException('recursoId é obrigatório');

    // Já existe pedido em aberto: reabrir criaria duas filas para o mesmo
    // trabalho, e o supervisor decidiria duas vezes a mesma coisa.
    const aberto = await this.repo.findOne({
      where: {
        workspaceId, recurso, recursoId: dto.recursoId, status: 'pendente',
      },
    });
    if (aberto) return aberto;

    const pedido = await this.repo.save(this.repo.create({
      workspaceId,
      recurso,
      recursoId: dto.recursoId,
      estudanteId: userId,
      supervisorId: null,
      status: 'pendente',
      parecer: null,
      decididoEm: null,
    }));

    this.auditService.log({
      userId, workspaceId, action: 'CREATE', resource: 'supervision_requests',
      resourceId: pedido.id,
    });
    return pedido;
  }

  async listar(
    workspaceId: string, filtros: { status?: string; estudanteId?: string } = {},
  ): Promise<SupervisionRequest[]> {
    const where: any = { workspaceId };
    if (filtros.status) {
      if (!STATUS.includes(filtros.status as any)) {
        throw new BadRequestException(`Status inválido. Use um de: ${STATUS.join(', ')}`);
      }
      where.status = filtros.status;
    }
    if (filtros.estudanteId) where.estudanteId = filtros.estudanteId;

    return this.repo.find({ where, order: { createdAt: 'ASC' }, take: 200 });
  }

  /**
   * Decisão do supervisor.
   *
   * Quem decide NÃO pode ser quem produziu. Autoaprovação esvazia o estágio:
   * o registro diria que houve revisão onde não houve, e a responsabilidade
   * profissional ficaria com quem ainda não pode assumi-la.
   */
  async decidir(
    workspaceId: string, supervisorId: string, id: string, dto: any,
  ): Promise<SupervisionRequest> {
    const pedido = await this.repo.findOne({ where: { id, workspaceId } });
    if (!pedido) throw new NotFoundException('Pedido de supervisão não encontrado');

    if (pedido.status !== 'pendente') {
      throw new BadRequestException(
        'Este pedido já foi decidido. O estagiário precisa solicitar nova revisão.',
      );
    }
    if (pedido.estudanteId === supervisorId) {
      throw new ForbiddenException(
        'Não é possível supervisionar o próprio trabalho. Peça a revisão a outro profissional.',
      );
    }

    const status = String(dto?.status ?? '');
    if (status !== 'aprovado' && status !== 'ajustes_solicitados') {
      throw new BadRequestException('Decisão deve ser "aprovado" ou "ajustes_solicitados"');
    }

    const parecer = dto?.parecer ? String(dto.parecer).trim() : '';
    if (status === 'ajustes_solicitados' && !parecer) {
      throw new BadRequestException(
        'Descreva o que precisa ser ajustado. "Ajustes solicitados" sem parecer não '
        + 'ensina nada a quem está aprendendo.',
      );
    }

    const mudancas: Partial<SupervisionRequest> = {
      status, supervisorId, parecer: parecer || null, decididoEm: new Date(),
    };
    await this.repo.update(id, mudancas);

    this.auditService.log({
      userId: supervisorId, workspaceId, action: 'UPDATE',
      resource: 'supervision_requests', resourceId: id, changes: { status },
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  /** Situação de supervisão de um trabalho, para a tela mostrar. */
  async doRecurso(
    workspaceId: string, recurso: string, recursoId: string,
  ): Promise<SupervisionRequest | null> {
    return this.repo.findOne({
      where: { workspaceId, recurso, recursoId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Pode entregar ao paciente?
   *
   * Exige aprovação AINDA VÁLIDA. A aprovação vale para o trabalho como ele
   * estava no momento da revisão: se o estagiário editou depois, o supervisor
   * aprovou outra coisa. Sem esta checagem, o caminho para burlar seria óbvio —
   * enviar uma versão simples, aprovar, e trocar o conteúdo em seguida.
   */
  async aprovacaoValida(
    workspaceId: string, recurso: string, recursoId: string, atualizadoEm: Date,
  ): Promise<{ liberado: boolean; motivo?: string }> {
    const pedido = await this.doRecurso(workspaceId, recurso, recursoId);

    if (!pedido) {
      return {
        liberado: false,
        motivo: 'Este trabalho ainda não foi enviado para supervisão.',
      };
    }
    if (pedido.status === 'pendente') {
      return { liberado: false, motivo: 'Aguardando a revisão do supervisor.' };
    }
    if (pedido.status === 'ajustes_solicitados') {
      return {
        liberado: false,
        motivo: `O supervisor pediu ajustes: ${pedido.parecer ?? '(sem parecer)'}`,
      };
    }
    if (pedido.decididoEm && atualizadoEm > new Date(pedido.decididoEm)) {
      return {
        liberado: false,
        motivo:
          'O trabalho foi alterado depois da aprovação — o supervisor aprovou outra versão. '
          + 'Solicite nova revisão.',
      };
    }
    return { liberado: true };
  }

  /** Quantos pedidos aguardam decisão. Serve ao aviso na tela do supervisor. */
  async pendentes(workspaceId: string): Promise<number> {
    return this.repo.count({ where: { workspaceId, status: 'pendente' } });
  }
}
