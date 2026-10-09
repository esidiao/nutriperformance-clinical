import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientSupplementation } from './patient-supplementation.entity';
import { AIEngineService as AiEngineService } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';
import { AlertsService } from '../alerts/alerts.service';
import { AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';

@Injectable()
export class SupplementationService {
  private readonly logger = new Logger(SupplementationService.name);

  constructor(
    @InjectRepository(PatientSupplementation)
    private readonly repo: Repository<PatientSupplementation>,
    private readonly aiEngine: AiEngineService,
    private readonly tokenService: TokenService,
    private readonly alertsService: AlertsService,
    private readonly auditService: AuditService,
    private readonly patientsService: PatientsService,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    dto: Partial<PatientSupplementation>,
  ): Promise<PatientSupplementation> {
    const entity = this.repo.create({ ...dto, workspaceId, prescribedBy: userId });
    const saved = await this.repo.save(entity);
    this.auditService.log({
      userId,
      workspaceId,
      action: 'CREATE',
      resource: 'patient_supplementation',
      resourceId: saved.id,
    });
    return saved;
  }

  /**
   * Suplementacoes do workspace, com o paciente identificado em cada linha.
   *
   * Mesma razao da lista de metas: a tela de topo mostrava dados de exemplo
   * escritos no codigo, e sem o nome do paciente uma lista assim nao serve
   * para nada. O nome vem do PatientsService porque esta criptografado.
   *
   * Padrao e so o que esta ATIVO: suplemento desativado e historico, e
   * misturar os dois numa tela de acompanhamento faz parecer que o paciente
   * toma o que ja parou de tomar.
   */
  async listarDoWorkspace(
    workspaceId: string,
    userId: string,
    filtros: { patientId?: string; incluirInativos?: boolean } = {},
  ) {
    const where: Record<string, unknown> = { workspaceId };
    if (filtros.patientId) where.patientId = filtros.patientId;
    if (!filtros.incluirInativos) where.isActive = true;

    const itens = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 500,
    });

    const nomes = await this.patientsService.nomesPorId(
      workspaceId,
      itens.map((i) => i.patientId),
      userId,
    );

    return itens.map((i) => ({ ...i, paciente: nomes.get(i.patientId) ?? null }));
  }

  async findByPatient(workspaceId: string, patientId: string): Promise<PatientSupplementation[]> {
    return this.repo.find({
      where: { workspaceId, patientId },
      order: { createdAt: 'DESC' },
      take: 500,
    });
  }

  async findOne(workspaceId: string, id: string): Promise<PatientSupplementation> {
    const entity = await this.repo.findOne({ where: { id, workspaceId } });
    if (!entity) throw new NotFoundException('Suplementação não encontrada');
    return entity;
  }

  async update(
    workspaceId: string,
    id: string,
    userId: string,
    dto: Partial<PatientSupplementation>,
  ): Promise<PatientSupplementation> {
    const entity = await this.findOne(workspaceId, id);
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    this.auditService.log({
      userId,
      workspaceId,
      action: 'UPDATE',
      resource: 'patient_supplementation',
      resourceId: id,
    });
    return saved;
  }

  async deactivate(workspaceId: string, id: string, userId: string): Promise<PatientSupplementation> {
    return this.update(workspaceId, id, userId, { isActive: false, endDate: new Date() });
  }

  async analyzeWithAi(
    workspaceId: string,
    patientId: string,
    userId: string,
  ): Promise<{ analysis: object; tokensConsumed: number }> {
    const supplements = await this.findByPatient(workspaceId, patientId);
    const active = supplements.filter((s) => s.isActive);

    // Analyze each active supplement; consolidate results
    const supplementNames = active.map((s) =>
      `${s.supplementName}${s.doseAmount ? ` ${s.doseAmount}${s.doseUnit ?? ''}` : ''}`,
    ).join(', ');

    const result = await this.aiEngine.analyzeSupplementation({
      supplement: supplementNames,
      dose: 'Conforme protocolo individual',
      frequency: 'Conforme protocolo individual',
      purpose: active.map((s) => s.therapeuticGoal).filter(Boolean).join('; ') || 'Não especificado',
      patientConditions: [],
      medications: [],
      patientAge: 0,
    });

    const cobrado = await this.tokenService.consume({
      workspaceId,
      userId,
      operation: 'supplementation_analysis',
      resourceId: patientId,
    });

    // Fire alert evaluation in background
    this.alertsService.evaluateSupplementation(patientId, workspaceId, active).catch((e: any) =>
      this.logger.warn(`Falha ao avaliar alertas de suplementação (patient=${patientId}): ${e?.message ?? e}`),
    );

    return { analysis: result, tokensConsumed: cobrado };
  }
}
