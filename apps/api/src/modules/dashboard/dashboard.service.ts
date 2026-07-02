import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../patients/patient.entity';
import { ClinicalAlert } from '../alerts/clinical-alert.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { TokenTransaction } from '../tokens/token-transaction.entity';

export interface DashboardStats {
  patients: { total: number; active: number; withAlerts: number };
  alerts: { pending: number; critical: number };
  reports: { total: number };
  workspace: { plan: string; tokenBalance: number; tokenReserved: number };
  pendingAlerts: Array<{
    id: string;
    severity: string;
    title: string;
    description: string;
    patientCode: string | null;
    createdAt: Date;
  }>;
  recentActivity: Array<{
    operation: string;
    module: string | null;
    amount: number;
    description: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(ClinicalAlert) private alertRepo: Repository<ClinicalAlert>,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
    @InjectRepository(TokenTransaction) private txRepo: Repository<TokenTransaction>,
  ) {}

  async getStats(workspaceId: string): Promise<DashboardStats> {
    const [
      totalPatients,
      activePatients,
      pendingAlerts,
      criticalAlerts,
      patientsWithAlerts,
      reportsTotal,
      pendingAlertsList,
      workspace,
      recentTx,
    ] = await Promise.all([
      this.patientRepo.count({ where: { workspaceId } }),
      this.patientRepo.count({ where: { workspaceId, isActive: true } }),
      this.alertRepo.count({ where: { workspaceId, isResolved: false } }),
      this.alertRepo.count({ where: { workspaceId, isResolved: false, severity: 'critical' } }),
      this.alertRepo
        .createQueryBuilder('a')
        .select('COUNT(DISTINCT a.patient_id)', 'count')
        .where('a.workspace_id = :workspaceId', { workspaceId })
        .andWhere('a.is_resolved = false')
        .getRawOne<{ count: string }>(),
      this.txRepo.count({ where: { workspaceId, module: 'report_generation' } }),
      this.alertRepo
        .createQueryBuilder('a')
        .leftJoin('patients', 'p', 'p.id = a.patient_id')
        .select([
          'a.id AS id',
          'a.severity AS severity',
          'a.title AS title',
          'a.description AS description',
          'a.created_at AS created_at',
          'p.internal_code AS patient_code',
        ])
        .where('a.workspace_id = :workspaceId', { workspaceId })
        .andWhere('a.is_resolved = false')
        .orderBy('a.created_at', 'DESC')
        .limit(5)
        .getRawMany<{
          id: string;
          severity: string;
          title: string;
          description: string;
          created_at: Date;
          patient_code: string | null;
        }>(),
      this.workspaceRepo.findOne({ where: { id: workspaceId } }),
      this.txRepo.find({
        where: { workspaceId },
        order: { createdAt: 'DESC' },
        take: 8,
      }),
    ]);

    return {
      patients: {
        total: totalPatients,
        active: activePatients,
        withAlerts: parseInt(patientsWithAlerts?.count ?? '0', 10),
      },
      alerts: {
        pending: pendingAlerts,
        critical: criticalAlerts,
      },
      reports: {
        total: reportsTotal,
      },
      workspace: {
        plan: workspace?.plan ?? 'free_trial',
        tokenBalance: workspace?.tokenBalance ?? 0,
        tokenReserved: workspace?.tokenReserved ?? 0,
      },
      pendingAlerts: pendingAlertsList.map((a) => ({
        id: a.id,
        severity: a.severity,
        title: a.title,
        description: a.description,
        patientCode: a.patient_code,
        createdAt: a.created_at,
      })),
      recentActivity: recentTx.map((t) => ({
        operation: t.operation,
        module: t.module,
        amount: t.amount,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  }
}
