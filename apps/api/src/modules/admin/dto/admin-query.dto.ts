import { IsInt, IsNumber, IsOptional, IsString, IsUUID, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

/**
 * Paginação do painel admin.
 *
 * Sem estes limites, `?limit=999999` devolvia a tabela inteira e `?page=abc`
 * virava `NaN` no OFFSET — o Postgres rejeitava a query com erro 500.
 */
export class ListWorkspacesQueryDto {
  @ApiPropertyOptional({ description: 'Página (1-based)', minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ description: 'Registros por página', minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;
}

export class AuditLogsQueryDto {
  @ApiPropertyOptional({ description: 'Página (1-based)', minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ description: 'Registros por página', minimum: 1, maximum: 200, default: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit = 100;

  @ApiPropertyOptional({ description: 'Filtra por workspace' })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;

  @ApiPropertyOptional({ description: 'Filtra por usuário' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filtra por recurso (ex: patient, laboratory_exam)' })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  resource?: string;

  @ApiPropertyOptional({ description: 'Data inicial (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Data final (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  to?: string;
}

export class AdjustTokensDto {
  @ApiProperty({ description: 'Ajuste de tokens (positivo credita, negativo debita)' })
  @Type(() => Number)
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  amount: number;

  @ApiProperty({ description: 'Justificativa do ajuste — obrigatória para auditoria' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class UpdateTokenCostDto {
  @ApiProperty({ description: 'Novo custo em tokens da operação', minimum: 0, maximum: 10_000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10_000)
  tokensCost: number;
}
