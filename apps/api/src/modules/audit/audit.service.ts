import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

interface LogParams {
  workspaceId?: string;
  userId?: string;
  patientId?: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'LOGIN' | 'LOGOUT';
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, unknown>;
  success?: boolean;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async log(params: LogParams): Promise<void> {
    const entry = this.auditRepo.create({
      workspaceId: params.workspaceId,
      userId: params.userId,
      patientId: params.patientId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      changes: params.changes,
      success: params.success ?? true,
    });
    // Fire-and-forget — não bloquear o fluxo principal; falhas são alertadas
    this.auditRepo.save(entry).catch((e: any) =>
      this.logger.warn(`Falha ao salvar audit log [${params.action} ${params.resource}/${params.resourceId}]: ${e?.message}`),
    );
  }

  async getForWorkspace(workspaceId: string, limit = 100, offset = 0) {
    return this.auditRepo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getForPatient(patientId: string) {
    return this.auditRepo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 500,
    });
  }
}
