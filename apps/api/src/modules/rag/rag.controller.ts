import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicalStaff } from '../../common/decorators';
import { RagService } from './rag.service';

class AskDto {
  @IsString() @MinLength(3) @MaxLength(500) question: string;
}

@ApiTags('assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistant')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('ask')
  @ClinicalStaff()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Pergunta nutricional em linguagem natural (RAG, respostas com fonte) — consome 5 tokens' })
  ask(@Body() dto: AskDto, @Req() req: any) {
    return this.ragService.ask({
      question: dto.question,
      workspaceId: req.user.workspaceId,
      userId: req.user.id,
    });
  }
}
