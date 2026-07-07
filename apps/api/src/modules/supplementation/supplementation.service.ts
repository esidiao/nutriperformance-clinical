import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientSupplementation } from './patient-supplementation.entity';
import { AIEngineService as AiEngineService } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';
import { AlertsService } from '../alerts/alerts.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SupplementationService {
  constructor(
    @InjectRepository(PatientSupplementation)
    private readonly repo: Repository<PatientSupplementation>,
    private readonly aiEngine: AiEngineService,
    private readonly tokenService: TokenService,
    private readonly alertsService: AlertsService,
    private readonly auditService: AuditService,
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

    const COST = 8;
    await this.tokenService.consume({
      workspaceId,
      userId,
      operation: 'supplementation_analysis',
      cost: COST,
      resourceId: patientId,
    });

    // Fire alert evaluation in background
    this.alertsService.evaluateSupplementation(patientId, workspaceId, active).catch(() => {});

    return { analysis: result, tokensConsumed: COST };
  }
}
