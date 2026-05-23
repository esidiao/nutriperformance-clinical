import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NutritionalAssessment } from './nutritional-assessment.entity';
import { PhysicalAssessment } from './physical-assessment.entity';
import { AIEngineService as AiEngineService } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AssessmentsService {
  constructor(
    @InjectRepository(NutritionalAssessment)
    private readonly nutritionalRepo: Repository<NutritionalAssessment>,
    @InjectRepository(PhysicalAssessment)
    private readonly physicalRepo: Repository<PhysicalAssessment>,
    private readonly aiEngine: AiEngineService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  // ── Nutritional ──────────────────────────────────────────────────────────

  async createNutritional(
    workspaceId: string,
    userId: string,
    dto: Partial<NutritionalAssessment>,
  ): Promise<NutritionalAssessment> {
    const assessment = this.nutritionalRepo.create({
      ...dto,
      workspaceId,
      createdBy: userId,
    });
    const saved = await this.nutritionalRepo.save(assessment);
    this.auditService.log({
      userId,
      workspaceId,
      action: 'CREATE',
      resource: 'nutritional_assessment',
      resourceId: saved.id,
    });
    return saved;
  }

  async findAllNutritional(workspaceId: string, patientId: string): Promise<NutritionalAssessment[]> {
    return this.nutritionalRepo.find({
      where: { workspaceId, patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async findOneNutritional(workspaceId: string, id: string, userId: string): Promise<NutritionalAssessment> {
    const assessment = await this.nutritionalRepo.findOne({ where: { id, workspaceId } });
    if (!assessment) throw new NotFoundException('Avaliação nutricional não encontrada');
    this.auditService.log({
      userId,
      workspaceId,
      action: 'READ',
      resource: 'nutritional_assessment',
      resourceId: id,
    });
    return assessment;
  }

  async updateNutritional(
    workspaceId: string,
    id: string,
    userId: string,
    dto: Partial<NutritionalAssessment>,
  ): Promise<NutritionalAssessment> {
    const assessment = await this.findOneNutritional(workspaceId, id, userId);
    Object.assign(assessment, dto);
    return this.nutritionalRepo.save(assessment);
  }

  async finalizeNutritional(workspaceId: string, id: string, userId: string): Promise<NutritionalAssessment> {
    return this.updateNutritional(workspaceId, id, userId, { isDraft: false });
  }

  async generateAiSummary(
    workspaceId: string,
    id: string,
    userId: string,
  ): Promise<{ summary: string; tokensConsumed: number }> {
    const assessment = await this.findOneNutritional(workspaceId, id, userId);

    const result = await this.aiEngine.summarizeNutritionalAssessment({
      patientId: assessment.patientId,
      mainComplaint: assessment.mainComplaint,
      bmr: assessment.basalMetabolicRate,
      tee: assessment.totalEnergyExpenditure,
      caloricTarget: assessment.caloricTarget,
      proteinTargetG: assessment.proteinTargetG,
      carbTargetG: assessment.carbTargetG,
      fatTargetG: assessment.fatTargetG,
      nutritionalDiagnosis: assessment.nutritionalDiagnosis,
      dietaryStrategy: assessment.dietaryStrategy,
    });

    const COST = 8;
    await this.tokenService.consume({
      workspaceId,
      userId,
      operation: 'nutritional_assessment_summary',
      cost: COST,
      resourceId: id,
    });

    await this.nutritionalRepo.update(id, {
      tokensConsumed: assessment.tokensConsumed + COST,
    });

    return { summary: result.content, tokensConsumed: COST };
  }

  // ── Physical ─────────────────────────────────────────────────────────────

  async createPhysical(
    workspaceId: string,
    userId: string,
    dto: Partial<PhysicalAssessment>,
  ): Promise<PhysicalAssessment> {
    const assessment = this.physicalRepo.create({
      ...dto,
      workspaceId,
      createdBy: userId,
    });
    const saved = await this.physicalRepo.save(assessment);
    this.auditService.log({
      userId,
      workspaceId,
      action: 'CREATE',
      resource: 'physical_assessment',
      resourceId: saved.id,
    });
    return saved;
  }

  async findAllPhysical(workspaceId: string, patientId: string): Promise<PhysicalAssessment[]> {
    return this.physicalRepo.find({
      where: { workspaceId, patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async findOnePhysical(workspaceId: string, id: string, userId: string): Promise<PhysicalAssessment> {
    const assessment = await this.physicalRepo.findOne({ where: { id, workspaceId } });
    if (!assessment) throw new NotFoundException('Avaliação física não encontrada');
    this.auditService.log({
      userId,
      workspaceId,
      action: 'READ',
      resource: 'physical_assessment',
      resourceId: id,
    });
    return assessment;
  }

  async updatePhysical(
    workspaceId: string,
    id: string,
    userId: string,
    dto: Partial<PhysicalAssessment>,
  ): Promise<PhysicalAssessment> {
    const assessment = await this.findOnePhysical(workspaceId, id, userId);
    Object.assign(assessment, dto);
    return this.physicalRepo.save(assessment);
  }

  async finalizePhysical(workspaceId: string, id: string, userId: string): Promise<PhysicalAssessment> {
    return this.updatePhysical(workspaceId, id, userId, { isDraft: false });
  }
}
