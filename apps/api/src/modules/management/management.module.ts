import { Module } from '@nestjs/common';
import { ManagementService } from './management.service';
import { ManagementController } from './management.controller';

/**
 * Sem `TypeOrmModule.forFeature`: o serviço usa a DataSource diretamente.
 *
 * É escolha, não atalho. São sete consultas de agregação com `FILTER`,
 * `percentile_cont` e subconsulta correlacionada; escritas em QueryBuilder
 * ficariam ilegíveis, e ilegível em consulta de gestão é como número errado
 * entra sem ninguém ver. O mesmo padrão já está em `ContasAtivasService`.
 */
@Module({
  providers: [ManagementService],
  controllers: [ManagementController],
})
export class ManagementModule {}
