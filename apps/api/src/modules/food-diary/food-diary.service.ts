import {
  Injectable, NotFoundException, BadRequestException, GoneException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { randomBytes, createHash } from 'node:crypto';
import { FoodDiaryLink, FoodDiaryEntry } from './food-diary.entities';
import { AuditService } from '../audit/audit.service';
import {
  lerConfig, urlDeEnvio, urlDeLeitura, caminhoDaFoto, TIPOS_ACEITOS,
} from './storage';

export const REFEICOES = [
  'cafe_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia',
] as const;

const DIAS_VALIDADE_PADRAO = 30;
const DIAS_VALIDADE_MAX = 180;
const MAX_DESCRICAO = 2000;

/** Teto de registros por dia, por link. Evita que um link vire depósito. */
const MAX_POR_DIA = 20;

export const gerarToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

@Injectable()
export class FoodDiaryService {
  constructor(
    @InjectRepository(FoodDiaryLink) private readonly linkRepo: Repository<FoodDiaryLink>,
    @InjectRepository(FoodDiaryEntry) private readonly entryRepo: Repository<FoodDiaryEntry>,
    private readonly auditService: AuditService,
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
        `Validade máxima de ${DIAS_VALIDADE_MAX} dias. Diário é acompanhamento de um período, `
        + 'não acesso permanente.',
      );
    }

    const token = gerarToken();
    const link = await this.linkRepo.save(this.linkRepo.create({
      workspaceId,
      patientId: dto.patientId,
      createdBy: userId,
      tokenHash: hashToken(token),
      status: 'ativo',
      expiraEm: new Date(Date.now() + dias * 864e5),
    }));

    this.auditService.log({
      userId, workspaceId, action: 'CREATE', resource: 'food_diary_links', resourceId: link.id,
    });
    return { link, token };
  }

  async listarLinks(workspaceId: string, patientId?: string) {
    const where: any = { workspaceId };
    if (patientId) where.patientId = patientId;
    return this.linkRepo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }

  async revogarLink(workspaceId: string, userId: string, id: string) {
    const link = await this.linkRepo.findOne({ where: { id, workspaceId } });
    if (!link) throw new NotFoundException('Link não encontrado');

    await this.linkRepo.update(id, { status: 'revogado' });
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'food_diary_links',
      resourceId: id, changes: { status: 'revogado' },
    });
    return this.linkRepo.findOneOrFail({ where: { id } });
  }

  /**
   * Registros do paciente, já com URL de foto assinada.
   *
   * As assinaturas são geradas em paralelo — uma chamada de rede por foto, em
   * série, faria uma semana de diário levar segundos para abrir.
   */
  async listarRegistros(
    workspaceId: string, patientId: string, filtros: { de?: string; ate?: string } = {},
  ) {
    const de = filtros.de ? new Date(filtros.de) : new Date(Date.now() - 14 * 864e5);
    const ate = filtros.ate ? new Date(filtros.ate) : new Date();
    if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) {
      throw new BadRequestException('Intervalo de datas inválido');
    }
    if (ate < de) throw new BadRequestException('A data final é anterior à inicial');

    const registros = await this.entryRepo.find({
      where: { workspaceId, patientId, tomadaEm: Between(de, ate) },
      order: { tomadaEm: 'DESC' },
      take: 500,
    });

    const cfg = lerConfig();
    const comFoto = await Promise.all(registros.map(async (r) => ({
      ...r,
      fotoUrl: r.fotoPath && cfg ? await urlDeLeitura(cfg, r.fotoPath) : null,
      fotoPath: undefined,
    })));

    return { registros: comFoto, adesao: this.adesao(registros, de, ate) };
  }

  /**
   * Adesão: dias com ao menos um registro, sobre os dias do período.
   *
   * Conta DIAS, não refeições. Contar refeições premiaria quem manda cinco
   * fotos num dia e some por uma semana — e o que interessa no acompanhamento
   * é a constância.
   */
  private adesao(registros: FoodDiaryEntry[], de: Date, ate: Date) {
    const dias = new Set(
      registros.map((r) => new Date(r.tomadaEm).toISOString().slice(0, 10)),
    );
    const totalDias = Math.max(
      1, Math.floor((ate.getTime() - de.getTime()) / 864e5) + 1,
    );
    return {
      diasComRegistro: dias.size,
      diasNoPeriodo: totalDias,
      percentual: Math.round((dias.size / totalDias) * 100),
      totalRegistros: registros.length,
    };
  }

  async comentar(workspaceId: string, userId: string, id: string, comentario: string) {
    const r = await this.entryRepo.findOne({ where: { id, workspaceId } });
    if (!r) throw new NotFoundException('Registro não encontrado');

    await this.entryRepo.update(id, { comentario: comentario?.trim() || null });
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'food_diary_entries', resourceId: id,
    });
    return this.entryRepo.findOneOrFail({ where: { id } });
  }

  // ── Superfície pública ────────────────────────────────────────────────────

  private async porToken(token: string): Promise<FoodDiaryLink> {
    if (!token || token.length < 20) throw new NotFoundException('Link inválido');
    const link = await this.linkRepo.findOne({ where: { tokenHash: hashToken(token) } });
    if (!link || link.status === 'revogado') throw new NotFoundException('Link inválido');
    if (new Date(link.expiraEm) < new Date()) {
      throw new GoneException('Este link expirou. Peça um novo à sua nutricionista.');
    }
    return link;
  }

  /**
   * O que o paciente vê ao abrir o diário.
   *
   * Como na anamnese, nenhum dado do paciente sai daqui. Devolve os registros
   * DELE — que ele mesmo enviou — mas sem comentário da profissional: aquilo é
   * anotação clínica, escrita para o prontuário, não para ser lida sem
   * contexto por quem está do outro lado.
   */
  async abrirPublico(token: string) {
    const link = await this.porToken(token);

    const desde = new Date(Date.now() - 7 * 864e5);
    const registros = await this.entryRepo.find({
      where: { workspaceId: link.workspaceId, patientId: link.patientId, tomadaEm: Between(desde, new Date()) },
      order: { tomadaEm: 'DESC' },
      take: 100,
    });

    const cfg = lerConfig();
    const enxutos = await Promise.all(registros.map(async (r) => ({
      id: r.id,
      refeicao: r.refeicao,
      descricao: r.descricao,
      tomadaEm: r.tomadaEm,
      fotoUrl: r.fotoPath && cfg ? await urlDeLeitura(cfg, r.fotoPath) : null,
    })));

    return { refeicoes: REFEICOES, expiraEm: link.expiraEm, registros: enxutos };
  }

  /**
   * Registra a refeição e, se houver foto, devolve a URL assinada de envio.
   *
   * O registro nasce ANTES do upload porque o id dele é o nome do arquivo. Se
   * o envio da foto falhar no celular, sobra um registro sem imagem — que é um
   * registro válido, não lixo: a descrição sozinha já serve ao acompanhamento.
   */
  async registrarPublico(token: string, dto: any) {
    const link = await this.porToken(token);

    const refeicao = String(dto?.refeicao ?? '');
    if (!REFEICOES.includes(refeicao as any)) {
      throw new BadRequestException(`Refeição inválida. Use uma de: ${REFEICOES.join(', ')}`);
    }

    const descricao = dto?.descricao ? String(dto.descricao).trim() : null;
    if (descricao && descricao.length > MAX_DESCRICAO) {
      throw new BadRequestException(`Descrição muito longa (máximo ${MAX_DESCRICAO} caracteres)`);
    }

    const tomadaEm = dto?.tomadaEm ? new Date(dto.tomadaEm) : new Date();
    if (Number.isNaN(tomadaEm.getTime())) {
      throw new BadRequestException('Data e hora inválidas');
    }
    if (tomadaEm.getTime() > Date.now() + 60_000) {
      throw new BadRequestException('A refeição está no futuro — confira o horário.');
    }

    // Nem foto nem descrição não é registro nenhum.
    if (!descricao && !dto?.mimeFoto) {
      throw new BadRequestException('Envie uma foto ou descreva a refeição.');
    }

    const inicioDoDia = new Date(tomadaEm); inicioDoDia.setHours(0, 0, 0, 0);
    const fimDoDia = new Date(tomadaEm); fimDoDia.setHours(23, 59, 59, 999);
    const noDia = await this.entryRepo.count({
      where: {
        workspaceId: link.workspaceId, patientId: link.patientId,
        tomadaEm: Between(inicioDoDia, fimDoDia),
      },
    });
    if (noDia >= MAX_POR_DIA) {
      throw new BadRequestException(`Limite de ${MAX_POR_DIA} registros por dia atingido.`);
    }

    const entry = await this.entryRepo.save(this.entryRepo.create({
      workspaceId: link.workspaceId,
      patientId: link.patientId,
      linkId: link.id,
      refeicao,
      descricao,
      fotoPath: null,
      tomadaEm,
      origem: 'paciente',
      comentario: null,
    }));

    let envio: { url: string; expiraEmS: number } | null = null;

    if (dto?.mimeFoto) {
      if (!TIPOS_ACEITOS.includes(dto.mimeFoto)) {
        throw new BadRequestException(
          `Formato de imagem não aceito. Use: ${TIPOS_ACEITOS.join(', ')}`,
        );
      }
      const cfg = lerConfig();
      if (!cfg) {
        throw new ServiceUnavailableException(
          'Armazenamento de fotos não configurado. O registro em texto foi salvo.',
        );
      }
      const caminho = caminhoDaFoto(link.workspaceId, link.patientId, entry.id, dto.mimeFoto);
      envio = await urlDeEnvio(cfg, caminho);
      await this.entryRepo.update(entry.id, { fotoPath: caminho });
    }

    this.auditService.log({
      userId: 'paciente-via-link',
      workspaceId: link.workspaceId,
      action: 'CREATE',
      resource: 'food_diary_entries',
      resourceId: entry.id,
    });

    return { id: entry.id, envio };
  }
}
