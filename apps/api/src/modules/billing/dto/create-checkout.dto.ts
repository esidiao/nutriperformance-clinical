import { IsString, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({ description: 'ID do pacote de tokens selecionado' })
  @IsString()
  packageId: string;

  @ApiProperty({ description: 'Quantidade de tokens', minimum: 1 })
  @IsNumber()
  @Min(1)
  tokens: number;

  @ApiProperty({ description: 'Preço em BRL', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  priceBrl: number;

  @ApiPropertyOptional({ description: 'Se é assinatura recorrente', default: false })
  @IsBoolean()
  @IsOptional()
  isSubscription?: boolean;
}
