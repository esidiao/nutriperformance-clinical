import {
  Controller, Post, Get, Patch, Param, Body, Req, Ip, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import {
  IsString, IsEmail, IsOptional, IsEnum, IsBoolean, IsDateString,
  IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PatientsService } from './patients.service';
import { ClinicalStaff } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

class MedicationDto {
  @IsString() name: string;
  @IsOptional() @IsString() activePrinciple?: string;
  @IsOptional() @IsString() dose?: string;
}

class CreatePatientDto {
  @IsString() name: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsDateString() birthDate: string;
  @IsEnum(['male','female','other','not_informed']) gender: 'male'|'female'|'other'|'not_informed';
  @IsOptional() @IsBoolean() isPregnant?: boolean;
  @IsOptional() @IsBoolean() isBreastfeeding?: boolean;
  @IsOptional() @IsString() internalCode?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MedicationDto) medications?: MedicationDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) clinicalConditions?: string[];
  @IsBoolean() lgpdConsent: boolean;
}

class UpdateClinicalContextDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MedicationDto) medications?: MedicationDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) clinicalConditions?: string[];
}

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Post()
  @ClinicalStaff()
  @ApiOperation({ summary: 'Cadastrar paciente — requer consentimento LGPD explícito' })
  async create(@Body() dto: CreatePatientDto, @Req() req: any, @Ip() ip: string) {
    if (!dto.lgpdConsent) {
      return { error: 'Consentimento LGPD é obrigatório para cadastro do paciente.' };
    }
    return this.patientsService.create(
      { ...dto, birthDate: new Date(dto.birthDate), workspaceId: req.user.workspaceId, createdBy: req.user.id, lgpdConsentIp: ip },
      req.user.id,
      ip,
    );
  }

  @Get()
  @ClinicalStaff()
  @ApiOperation({ summary: 'Listar pacientes do workspace (paginado)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'code', required: false, type: String, description: 'Filtro por código interno' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  async list(
    @Req() req: any,
    @Ip() ip: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('code') code?: string,
    @Query('active') active?: string,
  ) {
    return this.patientsService.listByWorkspace(req.user.workspaceId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      code: code || undefined,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      requestingUserId: req.user.id,
      requestingIp: ip,
    });
  }

  @Get(':id')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Buscar paciente — gera audit log (LGPD)' })
  async findOne(@Param('id') id: string, @Req() req: any, @Ip() ip: string) {
    return this.patientsService.findById(id, req.user.id, req.user.workspaceId, ip);
  }

  @Patch(':id')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Atualizar contexto clínico do paciente (medicamentos/condições)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClinicalContextDto,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.patientsService.updateClinicalContext(id, req.user.workspaceId, req.user.id, ip, dto);
  }

  @Post(':id/deletion-request')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Solicitar exclusão de dados (LGPD Art. 18)' })
  async requestDeletion(@Param('id') id: string, @Req() req: any) {
    await this.patientsService.requestDeletion(id, req.user.workspaceId, req.user.id);
    return {
      message: 'Solicitação de exclusão registrada. Dados serão anonimizados em até 30 dias conforme LGPD.',
      requestedAt: new Date().toISOString(),
    };
  }
}
