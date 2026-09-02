import {
  Injectable, NotFoundException, BadRequestException, ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import { ProgressPhoto } from './progress-photo.entity';
import { AuditService } from '../audit/audit.service';
import {
  lerConfig, urlDeEnvio, urlDeLeitura, remover, caminhoDaFoto, TIPOS_ACEITOS,
} from '../../common/storage';

export const ANGULOS = ['frente', 'perfil', 'costas'] as const;

/**
 * Mesma retenção das fotos do diário, decidida em 01/09/2026.
 *
 * Foto corporal é ao menos tão sensível quanto foto de refeição — guardar por
 * mais tempo precisaria de uma razão, e não há.
 */
export const MESES_RETENCAO = 12;

const LOTE_EXPURGO = 200;

@Injectable()
export class ProgressPhotosService {
  constructor(
    @InjectRepository(ProgressPhoto) private readonly repo: Repository<ProgressPhoto>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Cria o registro e devolve a URL assinada de envio.
   *
   * A foto não passa pela API, como no diário: vai direto ao Storage. Aqui isso
   * pesa ainda mais — é imagem corporal, e cada intermediário a mais é mais um
   * lugar por onde ela transita.
   */
  async criar(workspaceId: string, userId: string, dto: any) {
    const angulo = String(dto?.angulo ?? '');
    if (!ANGULOS.includes(angulo as any)) {
      throw new BadRequestException(
        `Ângulo inválido. Use um de: ${ANGULOS.join(', ')}. `
        + 'A comparação só vale entre fotos do mesmo ponto de vista.',
      );
    }
    if (!dto?.patientId) throw new BadRequestException('patientId é obrigatório');
    if (!dto?.mimeFoto || !TIPOS_ACEITOS.includes(dto.mimeFoto)) {
      throw new BadRequestException(
        `Formato de imagem não aceito. Use: ${TIPOS_ACEITOS.join(', ')}`,
      );
    }

    const tiradaEm = String(dto.tiradaEm ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tiradaEm)) {
      throw new BadRequestException('Data inválida — use o formato AAAA-MM-DD');
    }
    if (tiradaEm > new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('A data está no futuro — confira antes de enviar.');
    }

    const cfg = lerConfig();
    if (!cfg) {
      throw new ServiceUnavailableException(
        'Armazenamento de fotos não configurado. Nada foi salvo.',
      );
    }

    const foto = await this.repo.save(this.repo.create({
      workspaceId,
      patientId: dto.patientId,
      createdBy: userId,
      angulo,
      // Provisório: o caminho definitivo depende do id, que só existe agora.
      fotoPath: 'pendente',
      tiradaEm,
      observacao: dto.observacao ? String(dto.observacao).slice(0, 1000) : null,
      removidaEm: null,
    }));

    const caminho = caminhoDaFoto(workspaceId, dto.patientId, foto.id, dto.mimeFoto, 'evolucao');
    await this.repo.update(foto.id, { fotoPath: caminho });
    const envio = await urlDeEnvio(cfg, caminho);

    this.auditService.log({
      userId, workspaceId, patientId: dto.patientId,
      action: 'CREATE', resource: 'progress_photos', resourceId: foto.id,
    });
    return { id: foto.id, envio };
  }

  /**
   * Fotos do paciente agrupadas por ângulo e ordenadas no tempo.
   *
   * O agrupamento é do serviço, não da tela: comparar fotos de ângulos
   * diferentes seria uma comparação sem sentido, e deixar isso para a
   * interface é confiar que ninguém vai errar.
   */
  async listar(workspaceId: string, patientId: string) {
    const fotos = await this.repo.find({
      where: { workspaceId, patientId },
      order: { tiradaEm: 'ASC' },
      take: 300,
    });

    const cfg = lerConfig();
    const comUrl = await Promise.all(fotos.map(async (f) => ({
      id: f.id,
      angulo: f.angulo,
      tiradaEm: f.tiradaEm,
      observacao: f.observacao,
      removidaEm: f.removidaEm,
      fotoUrl: !f.removidaEm && f.fotoPath !== 'pendente' && cfg
        ? await urlDeLeitura(cfg, f.fotoPath)
        : null,
    })));

    return ANGULOS.map((angulo) => ({
      angulo,
      fotos: comUrl.filter((f) => f.angulo === angulo),
    })).filter((g) => g.fotos.length > 0);
  }

  /**
   * Exclusão definitiva, a pedido.
   *
   * Foto corporal é o único conteúdo do sistema que apago de verdade em vez de
   * desativar. O motivo é a natureza dela: se a pessoa pede que a imagem do
   * corpo dela saia, guardar uma cópia "inativa" não atende o pedido — atende
   * a conveniência do sistema.
   */
  async remover(workspaceId: string, userId: string, id: string) {
    const foto = await this.repo.findOne({ where: { id, workspaceId } });
    if (!foto) throw new NotFoundException('Foto não encontrada');

    const cfg = lerConfig();
    if (cfg && foto.fotoPath !== 'pendente') {
      // Storage primeiro: se falhar, o ponteiro fica e a próxima tentativa
      // reencontra o arquivo. Invertido, sobraria imagem órfã que ninguém sabe
      // que existe.
      const removidas = await remover(cfg, [foto.fotoPath]);
      if (removidas === 0) {
        throw new ServiceUnavailableException(
          'O armazenamento não confirmou a remoção. Nada foi alterado — tente de novo.',
        );
      }
    }

    await this.repo.delete(id);
    this.auditService.log({
      userId, workspaceId, patientId: foto.patientId,
      action: 'DELETE', resource: 'progress_photos', resourceId: id,
    });
    return { ok: true };
  }

  async anotar(workspaceId: string, userId: string, id: string, observacao: string) {
    const foto = await this.repo.findOne({ where: { id, workspaceId } });
    if (!foto) throw new NotFoundException('Foto não encontrada');

    await this.repo.update(id, { observacao: observacao?.trim()?.slice(0, 1000) || null });
    this.auditService.log({
      userId, workspaceId, action: 'UPDATE', resource: 'progress_photos', resourceId: id,
    });
    return this.repo.findOneOrFail({ where: { id } });
  }

  /**
   * Expurgo pela retenção. Mesma mecânica do diário: Storage primeiro, banco
   * depois, e só se o Storage confirmar.
   *
   * Diferente do diário, aqui o REGISTRO também some. No diário o texto da
   * refeição continua servindo ao acompanhamento sem a foto; um registro de
   * foto de evolução sem a foto não é nada — só um carimbo de que existiu uma
   * imagem que ninguém pode mais ver.
   */
  async expurgar(opcoes: { simular?: boolean; meses?: number } = {}) {
    const meses = Number(opcoes.meses ?? MESES_RETENCAO);
    if (!Number.isFinite(meses) || meses < 1) {
      throw new BadRequestException('Meses de retenção deve ser 1 ou mais');
    }

    const corte = new Date();
    corte.setMonth(corte.getMonth() - meses);

    const alvos = await this.repo.find({
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
        restam: alvos.length,
      };
    }

    const cfg = lerConfig();
    if (!cfg) {
      throw new ServiceUnavailableException('Armazenamento não configurado — nada foi alterado.');
    }

    const caminhos = alvos.map((a) => a.fotoPath).filter((c) => c && c !== 'pendente');
    const removidas = caminhos.length ? await remover(cfg, caminhos) : 0;

    if (caminhos.length && removidas === 0) {
      return {
        corte, encontradas: alvos.length, removidas: 0, simulado: false,
        erro: 'O armazenamento não confirmou nenhuma remoção. Nada foi alterado no banco.',
        restam: alvos.length,
      };
    }

    await this.repo.delete(alvos.map((a) => a.id));
    this.auditService.log({
      userId: 'retencao-automatica', workspaceId: 'sistema',
      action: 'DELETE', resource: 'progress_photos',
      resourceId: `${alvos.length} registros`,
    });

    const restam = await this.repo.count({
      where: { createdAt: LessThan(corte), fotoPath: Not(IsNull()) },
    });
    return { corte, encontradas: alvos.length, removidas, simulado: false, restam };
  }
}
