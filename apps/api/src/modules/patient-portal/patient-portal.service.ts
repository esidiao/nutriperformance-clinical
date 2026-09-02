import {
  Injectable, NotFoundException, BadRequestException, GoneException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'node:crypto';
import { PatientPortalLink } from './patient-portal-link.entity';
import { AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';
import { MealPlansService } from '../meal-plans/meal-plans.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { FoodDiaryService } from '../food-diary/food-diary.service';

/**
 * Validade padrão: um ciclo de acompanhamento, não "para sempre".
 * Mais curta que a do diário porque este link entrega conteúdo prescrito, e
 * não apenas o que o próprio paciente enviou.
 */
const DIAS_VALIDADE_PADRAO = 90;
const DIAS_VALIDADE_MAX = 180;

export const gerarToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

@Injectable()
export class PatientPortalService {
  constructor(
    @InjectRepository(PatientPortalLink)
    private readonly repo: Repository<PatientPortalLink>,
    private readonly auditService: AuditService,
    private readonly patientsService: PatientsService,
    private readonly mealPlansService: MealPlansService,
    private readonly appointmentsService: AppointmentsService,
    private readonly foodDiaryService: FoodDiaryService,
  ) {}

  // ── Lado da profissional ──────────────────────────────────────────────────

  async criarLink(workspaceId: string, userId: string, dto: any) {
    if (!dto?.patientId) throw new BadRequestException('patientId é obrigatório');

    const dias = Number(dto.diasValidade ?? DIAS_VALIDADE_PADRAO);
    if (!Number.isFinite(dias) || dias <= 0) {
      throw new BadRequestException('Validade deve ser maior que zero');
    }
    if (dias > DIAS_VALIDADE_MAX) {
      throw new BadRequestException(
        `Validade máxima de ${DIAS_VALIDADE_MAX} dias. Este link entrega o plano alimentar `
        + 'prescrito — acesso permanente a conteúdo clínico não se justifica.',
      );
    }

    const token = gerarToken();
    const link = await this.repo.save(this.repo.create({
      workspaceId,
      patientId: dto.patientId,
      createdBy: userId,
      tokenHash: hashToken(token),
      status: 'ativo',
      expiraEm: new Date(Date.now() + dias * 864e5),
      ultimoAcessoEm: null,
    }));

    this.auditService.log({
      userId, workspaceId, patientId: dto.patientId,
      action: 'CREATE', resource: 'patient_portal_links', resourceId: link.id,
    });
    return { link, token };
  }

  async listarLinks(workspaceId: string, patientId?: string) {
    const where: any = { workspaceId };
    if (patientId) where.patientId = patientId;
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take: 50 });
  }

  async revogarLink(workspaceId: string, userId: string, id: string) {
    const link = await this.repo.findOne({ where: { id, workspaceId } });
    if (!link) throw new NotFoundException('Link não encontrado');

    await this.repo.update(id, { status: 'revogado' });
    this.auditService.log({
      userId, workspaceId, patientId: link.patientId,
      action: 'UPDATE', resource: 'patient_portal_links',
      resourceId: id, changes: { status: 'revogado' },
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  // ── Superfície pública ────────────────────────────────────────────────────

  private async porToken(token: string): Promise<PatientPortalLink> {
    if (!token || token.length < 20) throw new NotFoundException('Link inválido');
    const link = await this.repo.findOne({ where: { tokenHash: hashToken(token) } });
    if (!link || link.status === 'revogado') throw new NotFoundException('Link inválido');
    if (new Date(link.expiraEm) < new Date()) {
      throw new GoneException('Este link expirou. Peça um novo à sua nutricionista.');
    }
    return link;
  }

  /**
   * O que o paciente vê no portal.
   *
   * Três recortes deliberados:
   *
   * 1. SÓ O PLANO PUBLICADO. Rascunho é trabalho em andamento; um paciente que
   *    abrisse um plano pela metade seguiria um plano pela metade.
   *
   * 2. SÓ O PLANO MAIS RECENTE. Mostrar o histórico faria a pessoa não saber
   *    qual seguir — e em prescrição alimentar, seguir o plano errado é o
   *    problema, não a falta de informação.
   *
   * 3. `orientacoesGerais` SIM, `observacoes` NÃO. O nome do primeiro diz que
   *    é orientação para o paciente. O segundo é ambíguo e pode conter
   *    anotação clínica escrita para o prontuário — na dúvida sobre para quem
   *    um texto foi escrito, ele não vai para o paciente.
   */
  async abrirPortal(token: string, ip = 'portal') {
    const link = await this.porToken(token);

    // Registra o acesso: dado sensível sendo lido por fora do sistema precisa
    // aparecer na trilha. `findById` já grava o log de LGPD.
    const paciente = await this.patientsService.findById(
      link.patientId, 'paciente-via-portal', link.workspaceId, ip,
    );

    await this.repo.update(link.id, { ultimoAcessoEm: new Date() });

    const planos = await this.mealPlansService.findByPatient(link.workspaceId, link.patientId);
    const publicado = planos.find((p) => !p.isDraft && !p.isTemplate);

    let plano: any = null;
    if (publicado) {
      const completo: any = await this.mealPlansService.findOne(link.workspaceId, publicado.id);
      plano = {
        nome: completo.nome,
        objetivo: completo.objetivo,
        orientacoesGerais: completo.orientacoesGerais,
        dataInicio: completo.dataInicio,
        dataFim: completo.dataFim,
        refeicoes: completo.refeicoes,
        totais: completo.totais,
        // metaKcal e demais metas ficam de fora: número de meta sem o contexto
        // da consulta vira alvo, e alvo vira cobrança.
      };
    }

    const agora = new Date();
    const consultas = (await this.appointmentsService.listar(link.workspaceId, {
      de: agora.toISOString(),
      ate: new Date(agora.getTime() + 90 * 864e5).toISOString(),
      patientId: link.patientId,
    }))
      .filter((c) => c.status === 'agendada' || c.status === 'confirmada')
      .map((c) => ({ inicio: c.inicio, fim: c.fim, tipo: c.tipo, status: c.status }));

    const diario = await this.foodDiaryService.listarRegistros(
      link.workspaceId, link.patientId,
      { de: new Date(agora.getTime() - 7 * 864e5).toISOString() },
    );

    return {
      // Só o primeiro nome. Confirma para a pessoa que ela está no lugar certo
      // sem escrever o nome completo numa página aberta por link.
      primeiroNome: String(paciente?.name ?? '').split(' ')[0] || null,
      plano,
      consultas,
      diario: diario.registros.map((r: any) => ({
        id: r.id, refeicao: r.refeicao, descricao: r.descricao,
        tomadaEm: r.tomadaEm, fotoUrl: r.fotoUrl,
        // `comentario` da profissional NÃO vai: é anotação clínica, escrita
        // para o prontuário e não para ser lida sem contexto.
      })),
      expiraEm: link.expiraEm,
    };
  }

  /**
   * Registro de refeição pelo portal.
   *
   * Delega ao diário em vez de reimplementar: as regras de teto diário,
   * formato de foto e refeição no futuro são as mesmas, e duplicá-las faria as
   * duas cópias divergirem na primeira mudança.
   */
  async registrarRefeicao(token: string, dto: any) {
    const link = await this.porToken(token);
    return this.foodDiaryService.registrarPorPortal(
      link.workspaceId, link.patientId, dto,
    );
  }
}
