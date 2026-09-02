import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupervisionRequest } from './supervision-request.entity';
import { SupervisionService } from './supervision.service';
import { SupervisionController } from './supervision.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([SupervisionRequest]), AuditModule],
  providers: [SupervisionService],
  controllers: [SupervisionController],
  exports: [SupervisionService],
})
export class SupervisionModule {}
