import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NutritionalAssessment } from './nutritional-assessment.entity';
import { PhysicalAssessment } from './physical-assessment.entity';
import { AudioIntakeDto } from './dto/audio-intake.dto';
import { AIEngineService as AiEngineService, AudioIntakeResult } from '../ai/ai-engine.service';
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
      take: 500,
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

    const cobrado = await this.tokenService.consume({
      workspaceId,
      userId,
      operation: 'nutritional_assessment_summary',
      resourceId: id,
    });

    await this.nutritionalRepo.update(id, {
      tokensConsumed: assessment.tokensConsumed + cobrado,
    });

    return { summary: result.content, tokensConsumed: cobrado };
  }

  // ── Anamnese por áudio ───────────────────────────────────────────────────

  /**
   * Transcreve a gravação da consulta e devolve os campos da anamnese.
   *
   * Não persiste nada: o profissional revisa e confirma os campos na tela antes
   * de salvar a avaliação. O áudio também não é armazenado — só trafega em
   * memória até a chamada ao Gemini.
   */
  async transcribeAudioIntake(
    workspaceId: string,
    userId: string,
    kind: 'nutritional' | 'physical',
    dto: AudioIntakeDto,
  ): Promise<AudioIntakeResult & { tokensConsumed: number }> {
    // Portão de saldo antes da chamada paga: sem isso o Gemini seria cobrado
    // do nosso lado mesmo quando o workspace não tem tokens para pagar.
    //
    // A conferência fica aqui e não num @RequiresTokens na rota de propósito: a
    // mensagem do guard é genérica, e transcrição é a operação mais cara da
    // plataforma (áudio custa ~32 tokens por segundo gravado). Quem acabou de
    // gravar meia hora de consulta precisa saber exatamente o que faltou.
    const custo = await this.tokenService.getCostFor(`${kind}_audio_intake`);
    const { available } = await this.tokenService.getBalance(workspaceId);
    if (available < custo) {
      throw new BadRequestException(
        `Saldo insuficiente para transcrever a consulta. Disponível: ${available} tokens. Necessário: ${custo} tokens.`,
      );
    }

    const result = await this.aiEngine.transcribeAudioIntake(
      dto.audioBase64,
      dto.mimeType,
      kind,
    );

    const cobrado = await this.tokenService.consume({
      workspaceId,
      userId,
      operation: `${kind}_audio_intake`,
    });

    this.auditService.log({
      userId,
      workspaceId,
      action: 'CREATE',
      resource: `${kind}_audio_intake`,
    });

    return { ...result, tokensConsumed: cobrado };
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
      take: 500,
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
