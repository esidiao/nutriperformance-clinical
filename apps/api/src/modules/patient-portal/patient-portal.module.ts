import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientPortalLink } from './patient-portal-link.entity';
import { PatientPortalService } from './patient-portal.service';
import {
  PatientPortalController, PatientPortalPublicoController,
} from './patient-portal.controller';
import { AuditModule } from '../audit/audit.module';
import { PatientsModule } from '../patients/patients.module';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { FoodDiaryModule } from '../food-diary/food-diary.module';

/**
 * O portal nao consulta banco de outros modulos direto: usa os servicos deles.
 * Repetir as consultas aqui faria as regras divergirem — o portal poderia
 * mostrar um plano que o resto do sistema ja considera inativo.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PatientPortalLink]),
    AuditModule,
    PatientsModule,
    MealPlansModule,
    AppointmentsModule,
    FoodDiaryModule,
  ],
  providers: [PatientPortalService],
  controllers: [PatientPortalController, PatientPortalPublicoController],
  exports: [PatientPortalService],
})
export class PatientPortalModule {}
