import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Workspace } from './modules/workspaces/workspace.entity';
import { User } from './modules/users/user.entity';
import { Patient } from './modules/patients/patient.entity';
import { TokenTransaction } from './modules/tokens/token-transaction.entity';
import { TokenCost } from './modules/tokens/token-cost.entity';
import { InteractionAnalysis } from './modules/interactions/interaction-analysis.entity';
import { BioavailabilityAnalysis } from './modules/bioavailability/bioavailability-analysis.entity';
import { ClinicalAlert } from './modules/alerts/clinical-alert.entity';
import { AuditLog } from './modules/audit/audit-log.entity';
import { NutritionalAssessment } from './modules/assessments/nutritional-assessment.entity';
import { PhysicalAssessment } from './modules/assessments/physical-assessment.entity';
import { PatientSupplementation } from './modules/supplementation/patient-supplementation.entity';
import { LaboratoryExam } from './modules/laboratory/laboratory-exam.entity';
import { PatientGoal } from './modules/goals/patient-goal.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  entities: [
    Workspace, User, Patient,
    TokenTransaction, TokenCost,
    InteractionAnalysis, BioavailabilityAnalysis,
    ClinicalAlert, AuditLog,
    NutritionalAssessment, PhysicalAssessment,
    PatientSupplementation, LaboratoryExam, PatientGoal,
  ],
  migrations: ['dist/migrations/*.js'],
  migrationsTableName: 'typeorm_migrations',
});
