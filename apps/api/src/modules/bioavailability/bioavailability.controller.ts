import { Controller, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { BioavailabilityService } from './bioavailability.service';
import { ClinicalStaff, RequiresTokens } from '../../common/decorators';

class AnalyzeBioavailabilityDto {
  @IsString() patientId: string;
  @IsArray() @IsString({ each: true }) nutrientsOrSupplements: string[];
  @IsArray() @IsString({ each: true }) giConditions: string[];
  @IsArray() @IsString({ each: true }) medications: string[];
  @IsArray() @IsString({ each: true }) surgicalHistory: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) dietaryFactors?: string[];
}

@ApiTags('bioavailability')
@ApiBearerAuth()
@Controller('bioavailability')
export class BioavailabilityController {
  constructor(private bioavailabilityService: BioavailabilityService) {}

  @Post('analyze')
  @ClinicalStaff()
  @RequiresTokens('bioavailability_analysis')
  @ApiOperation({ summary: 'Analisar biodisponibilidade nutricional — consome 12 tokens' })
  async analyze(@Body() dto: AnalyzeBioavailabilityDto, @Req() req: any) {
    return this.bioavailabilityService.analyze({
      ...dto,
      dietaryFactors: dto.dietaryFactors ?? [],
      workspaceId: req.user.workspaceId,
      userId: req.user.id,
    });
  }
}
