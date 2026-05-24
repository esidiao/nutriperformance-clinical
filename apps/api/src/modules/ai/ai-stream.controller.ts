import {
  Controller, Post, Body, Res, HttpCode, UseGuards,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AIEngineService } from './ai-engine.service';

interface StreamAnalysisDto {
  prompt: string;
  module: 'interactions' | 'nutritional' | 'bioavailability' | 'laboratory' | 'supplementation';
  maxTokens?: number;
}

/**
 * SSE (Server-Sent Events) endpoint for streaming AI responses.
 * Frontend uses useStreamingText hook to consume the stream.
 *
 * Protocol:
 *   POST /ai/stream → text/event-stream
 *   Each chunk: "data: <token>\n\n"
 *   Final:       "data: [DONE]\n\n"
 *   Error:       "data: [ERROR] <message>\n\n"
 */
@Controller('ai')
export class AIStreamController {
  private readonly logger = new Logger(AIStreamController.name);

  constructor(private readonly aiEngine: AIEngineService) {}

  @Post('stream')
  @HttpCode(200)
  async streamAnalysis(
    @Body() dto: StreamAnalysisDto,
    @Res() res: Response,
  ): Promise<void> {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    try {
      const maxTokens = Math.min(dto.maxTokens ?? 1024, 4096);
      const stream = this.aiEngine.generateStream(dto.prompt, maxTokens);

      for await (const chunk of stream) {
        // Escape newlines within data value (SSE spec)
        const escaped = chunk.replace(/\n/g, '↵');
        res.write(`data: ${escaped}\n\n`);
        // Flush to client immediately
        (res as any).flush?.();
      }

      res.write('data: [DONE]\n\n');
    } catch (err) {
      this.logger.error('AI stream error', err);
      res.write(`data: [ERROR] ${(err as Error).message}\n\n`);
    } finally {
      res.end();
    }
  }
}
