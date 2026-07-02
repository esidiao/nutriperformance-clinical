import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patients/patient.entity';
import { ClinicalAlert } from '../alerts/clinical-alert.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { TokenTransaction } from '../tokens/token-transaction.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, ClinicalAlert, Workspace, TokenTransaction])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
