import {
  Controller, Get, Patch, Body, Request, Ip, UseGuards, NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';

/**
 * Quem está logado — nome e registro de conselho.
 *
 * ============================== POR QUE EXISTE =============================
 *
 * O PDF de prescrição assinava **"Dra. Ana Costa · CRN-3 12345"**, uma
 * constante escrita em `prescriptions/new/page.tsx`. Era o que saía para o
 * paciente em qualquer prescrição, de qualquer profissional.
 *
 * Não é só nome errado: o registro de conselho identifica legalmente quem
 * assina um documento clínico. Atribuir um CRN inventado a um documento que
 * chega ao paciente é pior do que não assinar, porque parece assinado.
 *
 * É o mesmo defeito que o relatório de 07/10/2026 pegou com os PACIENTES
 * (quatro exemplos escritos no código, PDF "certinho" vinculado a paciente
 * inexistente). Ali a parte do paciente foi corrigida e a do profissional
 * ficou — e ninguém olhou de novo porque o PDF continuou saindo bonito.
 *
 * ============================ O QUE ELE DEVOLVE ============================
 *
 * Só a identidade profissional de quem pediu: nada de outras contas, nada do
 * workspace alheio. O `sub` do token é a chave, e a invariante
 * `users.id === auth_id` (ver `common/identidade-da-conta.ts`) é o que faz
 * essa busca encontrar a linha certa.
 */

/**
 * O que a pessoa pode mudar no PRÓPRIO perfil.
 *
 * `email`, `role` e `workspace_id` NÃO estão aqui, e a ausência é a regra:
 * papel é autorização, e deixar alguém editar o próprio papel é escalada de
 * privilégio pela porta da frente. Quem muda isso é o administrador, por
 * outro caminho.
 */
class AtualizarMeuPerfilDto {
  @IsOptional() @IsString() @Length(3, 120)
  nome?: string;

  /** Acrônimo do conselho: CRN, CREF, CRM... */
  @IsOptional() @IsString() @Length(2, 12)
  @Matches(/^[A-Za-zÀ-ÿ-]+$/, { message: 'Conselho deve ser só letras, como CRN ou CREF.' })
  conselho?: string;

  @IsOptional() @IsString() @Length(1, 40)
  conselhoNumero?: string;

  @IsOptional() @IsString() @Length(2, 2)
  @Matches(/^[A-Za-z]{2}$/, { message: 'UF deve ter duas letras, como GO.' })
  conselhoUf?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Identidade profissional de quem está logado' })
  async me(@Request() req: any) {
    const u = await this.repo.findOne({
      where: { id: req.user.sub, workspaceId: req.user.workspaceId },
    });

    // Conta sem linha em `users` existe (contas de teste, por exemplo). Devolver
    // 404 é melhor que devolver um esqueleto: a tela precisa saber que NÃO tem
    // identidade para assinar, em vez de assinar com campos vazios.
    if (!u) {
      throw new NotFoundException(
        'Sua conta não tem perfil profissional cadastrado. Um documento clínico '
        + 'não pode ser emitido sem nome e registro de conselho.',
      );
    }

    return {
      id: u.id,
      nome: u.fullName,
      email: u.email,
      papel: u.role,
      conselho: u.councilType,
      conselhoNumero: u.councilNumber,
      conselhoUf: u.councilState,
      /*
       * A composição do registro NÃO acontece aqui.
       *
       * Concatenar tipo + número dava "CFN CRN-3 12345" — acrônimo duplicado,
       * e quem registra nutricionista é o CRN, não o CFN. A regra que trata
       * isso vive em `apps/web/lib/registro-profissional.ts`, porque é lá que
       * o PDF e as telas a usam, e duas implementações da mesma frase foi
       * exatamente o defeito da medida caseira (22/10/2026).
       *
       * O servidor devolve os campos crus. Quem imprime compõe.
       */
    };
  }

  /**
   * Atualiza o PRÓPRIO perfil profissional.
   *
   * ============================ POR QUE AUDITADO =============================
   *
   * O registro de conselho é o que identifica quem assina documento clínico.
   * Mudá-lo muda a assinatura de tudo que for emitido daqui em diante — e,
   * num conflito posterior, a pergunta "quem assinou e com que registro" tem
   * de ter resposta. Por isso a mudança grava valor ANTERIOR e NOVO na
   * auditoria, não só "perfil atualizado".
   *
   * ========================= O QUE NÃO DÁ PARA MUDAR =========================
   *
   * Papel, e-mail e workspace. Papel é autorização: editar o próprio seria
   * escalada de privilégio. Ver `AtualizarMeuPerfilDto`.
   */
  @Patch('me')
  @ApiOperation({ summary: 'Atualiza o próprio perfil profissional' })
  async atualizarMe(
    @Request() req: any,
    @Body() dto: AtualizarMeuPerfilDto,
    @Ip() ip: string,
  ) {
    const u = await this.repo.findOne({
      where: { id: req.user.sub, workspaceId: req.user.workspaceId },
    });
    if (!u) throw new NotFoundException('Perfil não encontrado.');

    const mudancas: Record<string, { de: unknown; para: unknown }> = {};
    const trocar = (campo: keyof User, novo: unknown, rotulo: string) => {
      if (novo === undefined) return;
      const atual = (u as any)[campo];
      const limpo = typeof novo === 'string' ? novo.trim() : novo;
      if (limpo === '' || limpo === atual) return;
      mudancas[rotulo] = { de: atual, para: limpo };
      (u as any)[campo] = limpo;
    };

    trocar('fullName', dto.nome, 'nome');
    trocar('councilType', dto.conselho?.toUpperCase(), 'conselho');
    trocar('councilNumber', dto.conselhoNumero, 'conselhoNumero');
    trocar('councilState', dto.conselhoUf?.toUpperCase(), 'conselhoUf');

    // Nada mudou: devolver 200 sem gravar linha de auditoria falsa. Auditoria
    // cheia de "atualizou" sem mudança é auditoria que ninguém lê.
    if (Object.keys(mudancas).length === 0) return this.me(req);

    // Conselho e número andam juntos: um sem o outro não identifica ninguém,
    // e o PDF precisa dos dois para assinar.
    if ((u.councilType && !u.councilNumber) || (!u.councilType && u.councilNumber)) {
      throw new BadRequestException(
        'Conselho e número do registro precisam ser informados juntos — '
        + 'um sem o outro não identifica o profissional.',
      );
    }

    await this.repo.save(u);

    await this.audit.log({
      workspaceId: req.user.workspaceId,
      userId: req.user.sub,
      action: 'UPDATE',
      resource: 'users',
      resourceId: u.id,
      ipAddress: ip,
      changes: mudancas,
    });

    return this.me(req);
  }
}
