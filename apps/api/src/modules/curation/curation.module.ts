import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from '../foods/food.entity';
import { AuditModule } from '../audit/audit.module';
import { RagModule } from '../rag/rag.module';
import { CurationService } from './curation.service';
import { CurationController } from './curation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Food]), AuditModule, RagModule],
  providers: [CurationService],
  controllers: [CurationController],
})
export class CurationModule {}
