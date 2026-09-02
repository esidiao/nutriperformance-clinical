import {
  Injectable, NotFoundException, BadRequestException, GoneException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, Not, IsNull } from 'typeorm';
import { randomBytes, createHash } from 'node:crypto';
import { FoodDiaryLink, FoodDiaryEntry } from './food-diary.entities';
import { AuditService } from '../audit/audit.service';
import {
  lerConfig, urlDeEnvio, urlDeLeitura, remover, caminhoDaFoto, TIPOS_ACEITOS,
} from '../../common/storage';

export const REFEICOES = [
  'cafe_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia',
] as const;

const DIAS_VALIDADE_PADRAO = 30;
const DIAS_VALIDADE_MAX = 180;
const MAX_DESCRICAO = 2000;

/** Teto de registros por dia, por link. Evita que um link vire depósito. */
const MAX_POR_DIA = 20;

/** Retenção das fotos, decidida em 01/09/2026. */
export const MESES_RETENCAO_FOTO = 12;

/** Fotos por execução do expurgo. Lote pequeno cabe no tempo de resposta. */
const LOTE_EXPURGO = 200;

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
    return this.registrarPara(link.workspaceId, link.patientId, link.id, dto);
  }

  /**
   * Registro pelo portal do paciente (lacuna 2).
   *
   * Existe para o portal não reimplementar as regras: teto diário, formato de
   * foto, refeição no futuro. Duplicadas, as duas cópias divergiriam na
   * primeira mudança — e a que ficasse para trás aceitaria o que a outra
   * recusa.
   */
  async registrarPorPortal(workspaceId: string, patientId: string, dto: any) {
    return this.registrarPara(workspaceId, patientId, null, dto);
  }

  /** Núcleo do registro, sem saber por qual porta o paciente entrou. */
  private async registrarPara(
    workspaceId: string, patientId: string, linkId: string | null, dto: any,
  ) {
    const link = { workspaceId, patientId, id: linkId };

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

    // Não há usuário logado aqui — quem enviou foi o paciente pelo link. O
    // userId fica nulo (a coluna é uuid) e a origem vai no changes. Antes ia
    // 'paciente-via-link' como uuid, o INSERT falhava, e nada do que entra pelo
    // link público era auditado: justamente o caminho onde o rastro mais vale.
    this.auditService.log({
      workspaceId: link.workspaceId,
      patientId: link.patientId,
      action: 'CREATE',
      resource: 'food_diary_entries',
      resourceId: entry.id,
      changes: { origem: 'paciente-via-link' },
    });

    return { id: entry.id, envio };
  }
  // ── Retenção ──────────────────────────────────────────────────────────────

  /**
   * Apaga as fotos com mais de 12 meses. Mantém o registro.
   *
   * O relógio é `createdAt`, não `tomadaEm`: retenção mede há quanto tempo nós
   * guardamos o dado, não quando a pessoa comeu. Alguém que registre hoje uma
   * refeição de dois anos atrás não deve ter a foto apagada no mesmo dia.
   *
   * A ordem importa. Apaga do STORAGE primeiro e só então limpa o banco: se a
   * remoção do arquivo falhar, o ponteiro continua lá e a próxima execução
   * tenta de novo. Invertido, a linha perderia o caminho e o arquivo ficaria
   * órfão para sempre — sem nada no sistema que soubesse da existência dele.
   *
   * `simular` permite ver o que seria apagado antes de apagar. A primeira
   * execução de um expurgo em produção não deveria ser às cegas.
   */
  async expurgarFotosAntigas(opcoes: { simular?: boolean; meses?: number } = {}) {
    const meses = Number(opcoes.meses ?? MESES_RETENCAO_FOTO);
    if (!Number.isFinite(meses) || meses < 1) {
      throw new BadRequestException('Meses de retenção deve ser 1 ou mais');
    }

    const corte = new Date();
    corte.setMonth(corte.getMonth() - meses);

    const alvos = await this.entryRepo.find({
      where: { createdAt: LessThan(corte), fotoPath: Not(IsNull()) },
      order: { createdAt: 'ASC' },
      take: LOTE_EXPURGO,
    });

    if (!alvos.length) {
      return { corte, encontradas: 0, removidas: 0, simulado: !!opcoes.simular, restam: 0 };
    }

    if (opcoes.simular) {
      return {
        corte, encontradas: alvos.length, removidas: 0, simulado: true,
        maisAntiga: alvos[0].createdAt, restam: alvos.length,
      };
    }

    const cfg = lerConfig();
    if (!cfg) {
      throw new ServiceUnavailableException(
        'Armazenamento não configurado — expurgo não executado. Nada foi alterado.',
      );
    }

    const caminhos = alvos.map((a) => a.fotoPath!).filter(Boolean);
    const removidasNoStorage = await remover(cfg, caminhos);

    // Só limpa o banco se o Storage confirmou. Falha parcial deixa tudo para a
    // próxima execução, que é idempotente.
    if (removidasNoStorage === 0) {
      return {
        corte, encontradas: alvos.length, removidas: 0, simulado: false,
        erro: 'O armazenamento não confirmou nenhuma remoção. Nada foi alterado no banco.',
        restam: alvos.length,
      };
    }

    const agora = new Date();
    await this.entryRepo.update(
      alvos.map((a) => a.id) as any,
      { fotoPath: null, fotoRemovidaEm: agora },
    );

    // Sem userId/workspaceId: as três colunas são uuid, e passar
    // 'retencao-automatica' / 'sistema' / '12 registros' fazia o INSERT falhar
    // inteiro. Como o log é fire-and-forget, o erro virava um warn e o expurgo
    // — a operação que apaga foto de paciente — não deixava rastro nenhum.
    // Quem executou vai no changes, que é jsonb e aceita texto.
    this.auditService.log({
      action: 'DELETE',
      resource: 'food_diary_entries.foto',
      changes: { executadoPor: 'retencao-automatica', registros: alvos.length, corte },
    });

    const restam = await this.entryRepo.count({
      where: { createdAt: LessThan(corte), fotoPath: Not(IsNull()) },
    });

    return {
      corte, encontradas: alvos.length, removidas: removidasNoStorage,
      simulado: false, restam,
    };
  }
}
