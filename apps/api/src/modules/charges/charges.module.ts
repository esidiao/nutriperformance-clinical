import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Charge } from './charge.entity';
import { ChargesService } from './charges.service';
import { ChargesController } from './charges.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Charge]), AuditModule],
  providers: [ChargesService],
  controllers: [ChargesController],
  exports: [ChargesService],
})
export class ChargesModule {}
