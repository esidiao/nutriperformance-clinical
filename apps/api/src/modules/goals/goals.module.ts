import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientGoal } from './patient-goal.entity';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { AuditModule } from '../audit/audit.module';
import { PatientsModule } from '../patients/patients.module';

@Module({
  // PatientsModule: o nome do paciente está criptografado e só o
  // PatientsService descriptografa.
  imports: [TypeOrmModule.forFeature([PatientGoal]), AuditModule, PatientsModule],
  providers: [GoalsService],
  controllers: [GoalsController],
  exports: [GoalsService],
})
export class GoalsModule {}
