import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LaboratoryExam } from './laboratory-exam.entity';
import { AIEngineService as AiEngineService } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';
import { AlertsService } from '../alerts/alerts.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LaboratoryService {
  constructor(
    @InjectRepository(LaboratoryExam)
    private readonly repo: Repository<LaboratoryExam>,
    private readonly aiEngine: AiEngineService,
    private readonly tokenService: TokenService,
    private readonly alertsService: AlertsService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    dto: Partial<LaboratoryExam>,
  ): Promise<LaboratoryExam> {
    const exam = this.repo.create({ ...dto, workspaceId, createdBy: userId });
    const saved = await this.repo.save(exam);
    this.auditService.log({
      userId,
      workspaceId,
      action: 'CREATE',
      resource: 'laboratory_exam',
      resourceId: saved.id,
    });
    // Alert evaluation in background
    this.alertsService.evaluateLaboratory(dto.patientId!, workspaceId, saved).catch(() => {});
    return saved;
  }

  async findByPatient(workspaceId: string, patientId: string): Promise<LaboratoryExam[]> {
    return this.repo.find({
      where: { workspaceId, patientId },
      order: { collectionDate: 'DESC' },
    });
  }

  async findOne(workspaceId: string, id: string, userId: string): Promise<LaboratoryExam> {
    const exam = await this.repo.findOne({ where: { id, workspaceId } });
    if (!exam) throw new NotFoundException('Exame laboratorial não encontrado');
    this.auditService.log({
      userId,
      workspaceId,
      action: 'READ',
      resource: 'laboratory_exam',
      resourceId: id,
    });
    return exam;
  }

  async update(
    workspaceId: string,
    id: string,
    userId: string,
    dto: Partial<LaboratoryExam>,
  ): Promise<LaboratoryExam> {
    const exam = await this.findOne(workspaceId, id, userId);
    Object.assign(exam, dto);
    return this.repo.save(exam);
  }

  async analyzeWithAi(
    workspaceId: string,
    examId: string,
    userId: string,
    supplementContext?: string[],
  ): Promise<{ analysis: object; tokensConsumed: number }> {
    const exam = await this.findOne(workspaceId, examId, userId);

    const labResultsMap: Record<string, { value: number; unit: string; reference: string; status: string }> = {};
    if (exam.ferritinNgMl !== null && exam.ferritinNgMl !== undefined) {
      labResultsMap['ferritina'] = { value: exam.ferritinNgMl, unit: 'ng/mL', reference: '15–200', status: exam.ferritinNgMl < 15 ? 'low' : 'normal' };
    }
    if (exam.vitaminDNgMl !== null && exam.vitaminDNgMl !== undefined) {
      labResultsMap['vitamina_d'] = { value: exam.vitaminDNgMl, unit: 'ng/mL', reference: '30–100', status: exam.vitaminDNgMl < 20 ? 'low' : 'normal' };
    }

    const result = await this.aiEngine.analyzeLaboratoryContext(
      labResultsMap,
      supplementContext ?? [],
      [],
    );

    const COST = 10;
    await this.tokenService.consume({
      workspaceId,
      userId,
      operation: 'laboratory_analysis',
      cost: COST,
      resourceId: examId,
    });

    await this.repo.update(examId, {
      tokensConsumed: exam.tokensConsumed + COST,
    });

    return { analysis: result, tokensConsumed: COST };
  }

  async getLatest(workspaceId: string, patientId: string): Promise<LaboratoryExam | null> {
    return this.repo.findOne({
      where: { workspaceId, patientId },
      order: { collectionDate: 'DESC' },
    });
  }
}
