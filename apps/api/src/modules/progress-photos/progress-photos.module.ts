import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressPhoto } from './progress-photo.entity';
import { ProgressPhotosService } from './progress-photos.service';
import {
  ProgressPhotosController, ProgressPhotosRetencaoController,
} from './progress-photos.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProgressPhoto]), AuditModule],
  providers: [ProgressPhotosService],
  controllers: [ProgressPhotosController, ProgressPhotosRetencaoController],
  exports: [ProgressPhotosService],
})
export class ProgressPhotosModule {}
