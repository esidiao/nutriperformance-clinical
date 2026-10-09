import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientGoal } from './patient-goal.entity';
import { AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(PatientGoal)
    private readonly repo: Repository<PatientGoal>,
    private readonly auditService: AuditService,
    private readonly patientsService: PatientsService,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    dto: Partial<PatientGoal>,
  ): Promise<PatientGoal> {
    const goal = this.repo.create({
      ...dto,
      workspaceId,
      createdBy: userId,
      checkpoints: dto.baselineValue !== undefined
        ? [{ date: new Date().toLocaleDateString('pt-BR'), value: dto.baselineValue!, note: 'Baseline' }]
        : [],
    });
    const saved = await this.repo.save(goal);
    this.auditService.log({
      userId,
      workspaceId,
      action: 'CREATE',
      resource: 'patient_goal',
      resourceId: saved.id,
    });
    return saved;
  }

  /**
   * Metas do workspace inteiro, cada uma com o paciente identificado.
   *
   * A tela de Metas mostrava três exemplos escritos no código, e a testadora
   * leu como "metas de todos os pacientes misturadas". Não era mistura de dado
   * real — era dado falso. Mas a leitura dela apontou o requisito certo: sem o
   * nome do paciente em cada linha, uma lista de metas não serve para nada.
   *
   * O nome vem do PatientsService porque está criptografado no banco; JOIN em
   * SQL devolveria bytes. Meta de paciente que sumiu do workspace fica com
   * `paciente: null` em vez de desaparecer — some da tela seria perder o
   * registro sem avisar.
   */
  async listarDoWorkspace(
    workspaceId: string,
    userId: string,
    filtros: { patientId?: string; incluirConcluidas?: boolean } = {},
  ) {
    const where: Record<string, unknown> = { workspaceId };
    if (filtros.patientId) where.patientId = filtros.patientId;
    if (!filtros.incluirConcluidas) where.isAchieved = false;

    const metas = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 500,
    });

    const nomes = await this.patientsService.nomesPorId(
      workspaceId,
      metas.map((m) => m.patientId),
      userId,
    );

    return metas.map((m) => ({
      ...m,
      paciente: nomes.get(m.patientId) ?? null,
    }));
  }

  async findByPatient(workspaceId: string, patientId: string): Promise<PatientGoal[]> {
    return this.repo.find({
      where: { workspaceId, patientId },
      order: { createdAt: 'DESC' },
      take: 500,
    });
  }

  async findOne(workspaceId: string, id: string): Promise<PatientGoal> {
    const goal = await this.repo.findOne({ where: { id, workspaceId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');
    return goal;
  }

  async update(
    workspaceId: string,
    id: string,
    userId: string,
    dto: Partial<PatientGoal>,
  ): Promise<PatientGoal> {
    const goal = await this.findOne(workspaceId, id);
    Object.assign(goal, dto);
    return this.repo.save(goal);
  }

  async addCheckpoint(
    workspaceId: string,
    id: string,
    userId: string,
    value: number,
    note?: string,
  ): Promise<PatientGoal> {
    const goal = await this.findOne(workspaceId, id);
    if (goal.isAchieved) {
      throw new BadRequestException('Meta já foi marcada como atingida');
    }
    const checkpoint = {
      date: new Date().toLocaleDateString('pt-BR'),
      value,
      note,
      recordedBy: userId,
    };
    goal.checkpoints = [...goal.checkpoints, checkpoint];
    this.auditService.log({
      userId,
      workspaceId,
      action: 'UPDATE',
      resource: 'patient_goal',
      resourceId: id,
      changes: { action: 'add_checkpoint', value },
    });
    return this.repo.save(goal);
  }

  async markAchieved(workspaceId: string, id: string, userId: string): Promise<PatientGoal> {
    const goal = await this.findOne(workspaceId, id);
    goal.isAchieved = true;
    goal.achievedAt = new Date();
    goal.achievedBy = userId;
    this.auditService.log({
      userId,
      workspaceId,
      action: 'UPDATE',
      resource: 'patient_goal',
      resourceId: id,
      changes: { action: 'mark_achieved' },
    });
    return this.repo.save(goal);
  }

  async delete(workspaceId: string, id: string, userId: string): Promise<void> {
    const goal = await this.findOne(workspaceId, id);
    await this.repo.remove(goal);
    this.auditService.log({
      userId,
      workspaceId,
      action: 'DELETE',
      resource: 'patient_goal',
      resourceId: id,
    });
  }

  async getSummary(workspaceId: string, patientId: string): Promise<{
    total: number;
    inProgress: number;
    achieved: number;
    overdue: number;
  }> {
    const goals = await this.findByPatient(workspaceId, patientId);
    const today = new Date();
    return {
      total: goals.length,
      inProgress: goals.filter((g) => !g.isAchieved).length,
      achieved: goals.filter((g) => g.isAchieved).length,
      overdue: goals.filter((g) => {
        if (g.isAchieved || !g.targetDate) return false;
        return new Date(g.targetDate) < today;
      }).length,
    };
  }
}
