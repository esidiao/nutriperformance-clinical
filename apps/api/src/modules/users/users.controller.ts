import { Controller, Get, Request, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

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
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

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
      /** Pronto para o cabeçalho: "CRN-3 12345/SP". Null quando falta algo. */
      registro: u.councilType && u.councilNumber
        ? `${u.councilType} ${u.councilNumber}${u.councilState ? `/${u.councilState}` : ''}`
        : null,
    };
  }
}
