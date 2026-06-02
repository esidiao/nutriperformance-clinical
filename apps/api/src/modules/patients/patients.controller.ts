import {
  Controller, Post, Get, Patch, Param, Body, Req, Ip,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  IsString, IsEmail, IsOptional, IsEnum, IsBoolean, IsDateString,
} from 'class-validator';
import { PatientsService } from './patients.service';
import { ClinicalStaff } from '../../common/decorators';

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
  @IsBoolean() lgpdConsent: boolean;
}

@ApiTags('patients')
@ApiBearerAuth()
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
  @ApiOperation({ summary: 'Listar pacientes do workspace' })
  async list(@Req() req: any) {
    return this.patientsService.listByWorkspace(req.user.workspaceId);
  }

  @Get(':id')
  @ClinicalStaff()
  @ApiOperation({ summary: 'Buscar paciente — gera audit log (LGPD)' })
  async findOne(@Param('id') id: string, @Req() req: any, @Ip() ip: string) {
    return this.patientsService.findById(id, req.user.id, req.user.workspaceId, ip);
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
