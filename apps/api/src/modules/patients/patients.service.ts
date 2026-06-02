import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Patient } from './patient.entity';
import { AuditService } from '../audit/audit.service';

// =============================================================
// LGPD: Dados pessoais de pacientes são criptografados em repouso.
// CPF é armazenado apenas como hash para busca (não reversível).
// =============================================================

export interface CreatePatientDto {
  workspaceId: string;
  createdBy: string;
  name: string;
  email?: string;
  phone?: string;
  cpf?: string;
  birthDate: Date;
  gender: 'male' | 'female' | 'other' | 'not_informed';
  isPregnant?: boolean;
  isBreastfeeding?: boolean;
  lgpdConsentIp: string;
  internalCode?: string;
}

@Injectable()
export class PatientsService {
  private readonly encryptionKey: Buffer;
  private readonly ivLength = 16;

  constructor(
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    private config: ConfigService,
    private auditService: AuditService,
  ) {
    const keyHex = this.config.get<string>('ENCRYPTION_KEY')!;
    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  private encrypt(text: string): Buffer {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    // Armazenar IV + dados criptografados juntos
    return Buffer.concat([iv, encrypted]);
  }

  private decrypt(encryptedBuffer: Buffer): string {
    const iv = encryptedBuffer.subarray(0, this.ivLength);
    const encrypted = encryptedBuffer.subarray(this.ivLength);
    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private hashCpf(cpf: string): string {
    // Hash SHA-256 do CPF normalizado — não reversível
    const normalized = cpf.replace(/\D/g, '');
    return createHash('sha256').update(normalized + process.env.CPF_SALT).digest('hex');
  }

  async create(dto: CreatePatientDto, requestingUserId: string, requestingIp: string) {
    const patient = this.patientRepo.create({
      workspaceId: dto.workspaceId,
      nameEncrypted: this.encrypt(dto.name),
      emailEncrypted: dto.email ? this.encrypt(dto.email) : null,
      phoneEncrypted: dto.phone ? this.encrypt(dto.phone) : null,
      cpfHash: dto.cpf ? this.hashCpf(dto.cpf) : null,
      birthDate: dto.birthDate,
      gender: dto.gender,
      isPregnant: dto.isPregnant ?? false,
      isBreastfeeding: dto.isBreastfeeding ?? false,
      lgpdConsent: true,
      lgpdConsentAt: new Date(),
      lgpdConsentIp: requestingIp,
      internalCode: dto.internalCode,
      createdBy: dto.createdBy,
    });

    const saved = await this.patientRepo.save(patient);

    await this.auditService.log({
      workspaceId: dto.workspaceId,
      userId: requestingUserId,
      patientId: saved.id,
      action: 'CREATE',
      resource: 'patients',
      resourceId: saved.id,
      ipAddress: requestingIp,
    });

    return this.toPublicDto(saved, dto.name);
  }

  async findById(patientId: string, requestingUserId: string, workspaceId: string, requestingIp: string) {
    const patient = await this.patientRepo.findOne({
      where: { id: patientId, workspaceId },
    });

    if (!patient) throw new NotFoundException('Paciente não encontrado');

    // Log de acesso a dados sensíveis (LGPD)
    await this.auditService.log({
      workspaceId,
      userId: requestingUserId,
      patientId,
      action: 'READ',
      resource: 'patients',
      resourceId: patientId,
      ipAddress: requestingIp,
    });

    const name = patient.nameEncrypted ? this.decrypt(patient.nameEncrypted) : '—';
    const email = patient.emailEncrypted ? this.decrypt(patient.emailEncrypted) : undefined;

    return this.toPublicDto(patient, name, email);
  }

  async listByWorkspace(workspaceId: string) {
    const patients = await this.patientRepo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
    return patients.map((p) => {
      const name = p.nameEncrypted ? this.decrypt(p.nameEncrypted) : '—';
      return this.toPublicDto(p, name);
    });
  }

  async requestDeletion(patientId: string, workspaceId: string, requestingUserId: string) {
    const patient = await this.patientRepo.findOne({ where: { id: patientId, workspaceId } });
    if (!patient) throw new NotFoundException('Paciente não encontrado');

    await this.patientRepo.update(patientId, {
      dataDeletionRequestedAt: new Date(),
    });

    await this.auditService.log({
      workspaceId,
      userId: requestingUserId,
      patientId,
      action: 'DELETE',
      resource: 'patients',
      resourceId: patientId,
    });
  }

  async anonymize(patientId: string, workspaceId: string) {
    // LGPD: Substituir dados pessoais por placeholder anonimizado
    await this.patientRepo.update(
      { id: patientId, workspaceId },
      {
        nameEncrypted: this.encrypt('[ANONIMIZADO]'),
        emailEncrypted: null,
        phoneEncrypted: null,
        cpfHash: null,
        notesEncrypted: null,
        isActive: false,
      },
    );
  }

  private toPublicDto(patient: Patient, name: string, email?: string) {
    return {
      id: patient.id,
      internalCode: patient.internalCode,
      name, // descriptografado — apenas retornar ao profissional autorizado
      email,
      birthDate: patient.birthDate,
      age: this.calculateAge(patient.birthDate),
      gender: patient.gender,
      isPregnant: patient.isPregnant,
      isBreastfeeding: patient.isBreastfeeding,
      lgpdConsent: patient.lgpdConsent,
      lgpdConsentAt: patient.lgpdConsentAt,
      isActive: patient.isActive,
      createdAt: patient.createdAt,
    };
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
}
