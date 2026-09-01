import { Injectable, NotFoundException, BadRequestException, GoneException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'node:crypto';
import { PreConsultForm } from './pre-consult-form.entity';
import { AuditService } from '../audit/audit.service';
import { QUESTIONARIO, VERSAO_ATUAL, validarRespostas, questionarioDaVersao } from './questionario';

const DIAS_VALIDADE_PADRAO = 14;
const DIAS_VALIDADE_MAX = 60;

/**
 * 32 bytes de aleatoriedade criptográfica em base64url — 256 bits.
 * Adivinhar por força bruta não é uma ameaça realista; o risco real é o link
 * vazar por encaminhamento, e para isso servem a expiração e o uso único.
 */
export const gerarToken = () => randomBytes(32).toString('base64url');

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class PreConsultService {
  constructor(
    @InjectRepository(PreConsultForm) private readonly repo: Repository<PreConsultForm>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Cria o formulário e devolve o token em claro — a ÚNICA vez.
   *
   * Nenhuma outra rota devolve o token. Quem perdeu o link gera outro, e o
   * anterior continua válido até expirar ou ser cancelado, o que fica visível
   * na listagem.
   */
  async criar(workspaceId: string, userId: string, dto: any): Promise<{ form: PreConsultForm; token: string }> {
    if (!dto?.patientId) throw new BadRequestException('patientId é obrigatório');

    const dias = Number(dto.diasValidade ?? DIAS_VALIDADE_PADRAO);
    if (!Number.isFinite(dias) || dias <= 0) {
      throw new BadRequestException('Validade deve ser maior que zero');
    }
    if (dias > DIAS_VALIDADE_MAX) {
      throw new BadRequestException(
        `Validade máxima de ${DIAS_VALIDADE_MAX} dias. Link de anamnese que vale para sempre `
        + 'vira porta permanente para dado de saúde.',
      );
    }

    const token = gerarToken();
    const entity = this.repo.create({
      workspaceId,
      patientId: dto.patientId,
      appointmentId: dto.appointmentId ?? null,
      createdBy: userId,
      tokenHash: hashToken(token),
      status: 'pendente',
      expiraEm: new Date(Date.now() + dias * 864e5),
      versaoQuestionario: VERSAO_ATUAL,
      respostas: null,
      respondidoEm: null,
    });

    const form = await this.repo.save(entity);
    this.auditService.log({
      userId, workspaceId, action: 'CREATE', resource: 'pre_consult_forms', resourceId: form.id,
    });
    return { form, token };
  }

  async listar(workspaceId: string, patientId?: string): Promise<PreConsultForm[]> {
    const where: any = { workspaceId };
    if (patientId) where.patientId = patientId;
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async findOne(workspaceId: string, id: string): Promise<PreConsultForm> {
    const f = await this.repo.findOne({ where: { id, workspaceId } });
    if (!f) throw new NotFoundException('Formulário não encontrado');
    return f;
  }

  /**
   * Formulário com as perguntas DA VERSÃO EM QUE FOI RESPONDIDO.
   *
   * `questionario` vem null se a versão gravada não existir mais no código —
   * melhor a tela dizer que não sabe rotular do que rotular a resposta de
   * ontem com a pergunta de hoje.
   */
  async findOneComQuestionario(workspaceId: string, id: string) {
    const f = await this.findOne(workspaceId, id);
    return { ...f, questionario: questionarioDaVersao(f.versaoQuestionario) };
  }

  async cancelar(workspaceId: string, userId: string, id: string): Promise<PreConsultForm> {
    const atual = await this.findOne(workspaceId, id);
    if (atual.status === 'respondido') {
      throw new BadRequestException(
        'Formulário já respondido não pode ser cancelado — a resposta é registro do paciente.',
      );
    }
    await this.repo.update(id, { status: 'cancelado' });
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'pre_consult_forms',
      resourceId: id, changes: { status: 'cancelado' },
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  // ── Superfície pública ────────────────────────────────────────────────────

  /**
   * Busca pelo token. Uso interno das rotas públicas.
   *
   * Token inexistente e token cancelado devolvem o MESMO erro: quem está
   * sondando não deve conseguir distinguir "não existe" de "existe e foi
   * cancelado". Expirado e já respondido são diferentes de propósito — quem
   * chegou até aqui já tem o token, e uma mensagem clara evita que o paciente
   * ache que o sistema quebrou.
   */
  private async porToken(token: string): Promise<PreConsultForm> {
    if (!token || token.length < 20) throw new NotFoundException('Link inválido');

    const form = await this.repo.findOne({ where: { tokenHash: hashToken(token) } });
    if (!form || form.status === 'cancelado') throw new NotFoundException('Link inválido');
    return form;
  }

  /**
   * O que o paciente vê ao abrir o link.
   *
   * NÃO devolve nome, e-mail, telefone nem qualquer dado do paciente. Quem tem
   * o link pode ser quem recebeu o encaminhamento por engano; o formulário
   * pergunta, não informa. O identificador do paciente também não sai daqui.
   */
  async abrirPublico(token: string) {
    const form = await this.porToken(token);

    if (new Date(form.expiraEm) < new Date()) {
      throw new GoneException('Este link expirou. Peça um novo à sua nutricionista.');
    }
    if (form.status === 'respondido') {
      throw new GoneException('Este formulário já foi respondido. Obrigado!');
    }

    return {
      questionario: QUESTIONARIO,
      versao: form.versaoQuestionario,
      expiraEm: form.expiraEm,
    };
  }

  /** Recebe as respostas. Uma vez só. */
  async responderPublico(token: string, corpo: unknown) {
    const form = await this.porToken(token);

    if (new Date(form.expiraEm) < new Date()) {
      throw new GoneException('Este link expirou. Peça um novo à sua nutricionista.');
    }
    if (form.status === 'respondido') {
      throw new GoneException('Este formulário já foi respondido. Obrigado!');
    }

    const { erros, respostas } = validarRespostas(corpo);
    if (erros.length) {
      throw new BadRequestException({ message: 'Revise as respostas', erros });
    }

    await this.repo.update(form.id, {
      status: 'respondido',
      respostas,
      respondidoEm: new Date(),
    });

    // Autoria do paciente, não de um usuário do sistema: o registro precisa
    // dizer que veio de fora, pelo link, e não de alguém logado.
    this.auditService.log({
      userId: 'paciente-via-link',
      workspaceId: form.workspaceId,
      action: 'UPDATE',
      resource: 'pre_consult_forms',
      resourceId: form.id,
      changes: { status: 'respondido' },
    });

    return { ok: true };
  }
}
