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

    // Helper to add a marker only when the value is present
    const add = (
      key: string,
      value: number | null | undefined,
      unit: string,
      reference: string,
      statusFn: (v: number) => string,
    ) => {
      if (value !== null && value !== undefined) {
        labResultsMap[key] = { value, unit, reference, status: statusFn(value) };
      }
    };

    // Hematologia
    add('hemoglobina', exam.hemoglobinGDl, 'g/dL', 'H: 13–17.5 | M: 12–16',
      (v) => (v < 12 ? 'low' : v > 17.5 ? 'high' : 'normal'));
    add('hematocrito', exam.hematocritPct, '%', 'H: 39–52 | M: 35–47',
      (v) => (v < 35 ? 'low' : v > 52 ? 'high' : 'normal'));
    add('vcm', exam.mcvFl, 'fL', '80–100',
      (v) => (v < 80 ? 'low' : v > 100 ? 'high' : 'normal'));
    add('chcm', exam.mchcGDl, 'g/dL', '32–36',
      (v) => (v < 32 ? 'low' : v > 36 ? 'high' : 'normal'));
    add('leucocitos', exam.leukocytesUl, '/µL', '4000–11000',
      (v) => (v < 4000 ? 'low' : v > 11000 ? 'high' : 'normal'));
    add('plaquetas', exam.plateletsUl, '/µL', '150000–400000',
      (v) => (v < 150000 ? 'low' : v > 400000 ? 'high' : 'normal'));

    // Metabolismo do ferro
    add('ferritina', exam.ferritinNgMl, 'ng/mL', '15–200',
      (v) => (v < 15 ? 'low' : v > 200 ? 'high' : 'normal'));
    add('ferro_serico', exam.serumIronUgDl, 'µg/dL', '60–170',
      (v) => (v < 60 ? 'low' : v > 170 ? 'high' : 'normal'));
    add('tibc', exam.tibcUgDl, 'µg/dL', '240–450',
      (v) => (v < 240 ? 'low' : v > 450 ? 'high' : 'normal'));
    add('saturacao_transferrina', exam.transferrinSaturationPct, '%', '20–50',
      (v) => (v < 20 ? 'low' : v > 50 ? 'high' : 'normal'));

    // Vitaminas
    add('vitamina_d', exam.vitaminDNgMl, 'ng/mL', '30–100',
      (v) => (v < 20 ? 'low' : v > 100 ? 'high' : 'normal'));
    add('vitamina_b12', exam.vitaminB12PgMl, 'pg/mL', '200–900',
      (v) => (v < 200 ? 'low' : v > 900 ? 'high' : 'normal'));
    add('acido_folico', exam.folicAcidNgMl, 'ng/mL', '3–17',
      (v) => (v < 3 ? 'low' : v > 17 ? 'high' : 'normal'));

    // Minerais
    add('zinco', exam.zincUgDl, 'µg/dL', '70–120',
      (v) => (v < 70 ? 'low' : v > 120 ? 'high' : 'normal'));
    add('magnesio', exam.magnesiumMgDl, 'mg/dL', '1.7–2.4',
      (v) => (v < 1.7 ? 'low' : v > 2.4 ? 'high' : 'normal'));
    add('calcio', exam.calciumMgDl, 'mg/dL', '8.5–10.5',
      (v) => (v < 8.5 ? 'low' : v > 10.5 ? 'high' : 'normal'));

    // Glicemia e insulina
    add('glicose_jejum', exam.fastingGlucoseMgDl, 'mg/dL', '70–99',
      (v) => (v < 70 ? 'low' : v > 99 ? 'high' : 'normal'));
    add('hba1c', exam.hba1cPct, '%', '< 5.7',
      (v) => (v >= 6.5 ? 'high' : v >= 5.7 ? 'borderline' : 'normal'));
    add('insulina', exam.insulinUuiMl, 'µUI/mL', '2–25',
      (v) => (v < 2 ? 'low' : v > 25 ? 'high' : 'normal'));
    add('homa_ir', exam.homaIr, 'índice', '< 2.7',
      (v) => (v >= 2.7 ? 'high' : 'normal'));

    // Lipidograma
    add('colesterol_total', exam.totalCholesterolMgDl, 'mg/dL', '< 200',
      (v) => (v >= 240 ? 'high' : v >= 200 ? 'borderline' : 'normal'));
    add('hdl', exam.hdlMgDl, 'mg/dL', 'H: > 40 | M: > 50',
      (v) => (v < 40 ? 'low' : v > 60 ? 'optimal' : 'normal'));
    add('ldl', exam.ldlMgDl, 'mg/dL', '< 130',
      (v) => (v >= 160 ? 'high' : v >= 130 ? 'borderline' : 'normal'));
    add('vldl', exam.vldlMgDl, 'mg/dL', '< 30',
      (v) => (v >= 30 ? 'high' : 'normal'));
    add('triglicerideos', exam.triglyceridesMgDl, 'mg/dL', '< 150',
      (v) => (v >= 200 ? 'high' : v >= 150 ? 'borderline' : 'normal'));

    // Função renal
    add('creatinina', exam.creatinineMgDl, 'mg/dL', 'H: 0.7–1.3 | M: 0.5–1.1',
      (v) => (v > 1.3 ? 'high' : v < 0.5 ? 'low' : 'normal'));
    add('ureia', exam.ureaMgDl, 'mg/dL', '15–45',
      (v) => (v < 15 ? 'low' : v > 45 ? 'high' : 'normal'));
    add('acido_urico', exam.uricAcidMgDl, 'mg/dL', 'H: 3.4–7.0 | M: 2.4–5.7',
      (v) => (v > 7.0 ? 'high' : v < 2.4 ? 'low' : 'normal'));
    add('tfge', exam.egfrMlMin, 'mL/min/1.73m²', '≥ 60',
      (v) => (v < 60 ? 'low' : 'normal'));

    // Função hepática
    add('alt', exam.altUL, 'U/L', 'H: 7–55 | M: 7–45',
      (v) => (v > 55 ? 'high' : 'normal'));
    add('ast', exam.astUL, 'U/L', '10–40',
      (v) => (v > 40 ? 'high' : 'normal'));
    add('ggt', exam.ggtUL, 'U/L', 'H: 8–61 | M: 5–36',
      (v) => (v > 61 ? 'high' : 'normal'));
    add('albumina', exam.albuminGDl, 'g/dL', '3.5–5.0',
      (v) => (v < 3.5 ? 'low' : v > 5.0 ? 'high' : 'normal'));

    // Hormônios
    add('tsh', exam.tshUuiMl, 'µUI/mL', '0.4–4.0',
      (v) => (v < 0.4 ? 'low' : v > 4.0 ? 'high' : 'normal'));
    add('t4_livre', exam.freeT4NgDl, 'ng/dL', '0.8–1.8',
      (v) => (v < 0.8 ? 'low' : v > 1.8 ? 'high' : 'normal'));
    add('testosterona', exam.testosteroneNgDl, 'ng/dL', 'H: 270–1070 | M: 15–70',
      (v) => (v < 15 ? 'low' : 'normal'));
    add('cortisol', exam.cortisolUgDl, 'µg/dL', '6–23 (matinal)',
      (v) => (v < 6 ? 'low' : v > 23 ? 'high' : 'normal'));

    // Inflamação
    add('pcr', exam.crpMgL, 'mg/L', '< 3.0',
      (v) => (v >= 10 ? 'high' : v >= 3.0 ? 'borderline' : 'normal'));

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
