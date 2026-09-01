import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreConsultForm } from './pre-consult-form.entity';
import { PreConsultService } from './pre-consult.service';
import { PreConsultController, PreConsultPublicoController } from './pre-consult.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([PreConsultForm]), AuditModule],
  providers: [PreConsultService],
  controllers: [PreConsultController, PreConsultPublicoController],
  exports: [PreConsultService],
})
export class PreConsultModule {}
