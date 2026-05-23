import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Entities — needed for TypeORM entity list at root level
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

// Feature modules
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiModule } from './modules/ai/ai.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { InteractionsModule } from './modules/interactions/interactions.module';
import { BioavailabilityModule } from './modules/bioavailability/bioavailability.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { SupplementationModule } from './modules/supplementation/supplementation.module';
import { LaboratoryModule } from './modules/laboratory/laboratory.module';
import { GoalsModule } from './modules/goals/goals.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BillingModule } from './modules/billing/billing.module';
import { ScientificBaseModule } from './modules/scientific-base/scientific-base.module';
import { AdminModule } from './modules/admin/admin.module';

// Guards & Interceptors
import { RolesGuard } from './common/guards/roles.guard';
import { TokenBalanceGuard } from './common/guards/token-balance.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

// Health check
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: parseInt(config.get<string>('DB_PORT') ?? '6543', 10),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME') ?? 'postgres',
        ssl: config.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
        connectTimeoutMS: 10000,
        extra: { connectionTimeoutMillis: 10000 },
        retryAttempts: 0,
        retryDelay: 1000,
        entities: [
          Workspace, User, Patient,
          TokenTransaction, TokenCost,
          InteractionAnalysis, BioavailabilityAnalysis,
          ClinicalAlert, AuditLog,
          NutritionalAssessment, PhysicalAssessment,
          PatientSupplementation, LaboratoryExam, PatientGoal,
        ],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    // Repositories needed by global guards (TokenBalanceGuard)
    TypeOrmModule.forFeature([TokenCost, Workspace]),

    // All feature modules handle their own TypeOrmModule.forFeature + providers + controllers
    WorkspacesModule,
    UsersModule,
    PatientsModule,
    TokensModule,
    AuditModule,
    AiModule,
    AlertsModule,
    InteractionsModule,
    BioavailabilityModule,
    AssessmentsModule,
    SupplementationModule,
    LaboratoryModule,
    GoalsModule,
    ReportsModule,
    BillingModule,
    ScientificBaseModule,
    AdminModule,
  ],

  controllers: [HealthController],

  providers: [
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TokenBalanceGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
