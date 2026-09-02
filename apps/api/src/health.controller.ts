import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from './common/decorators';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get()
  async check() {
    let dbOk = false;
    try {
      await this.dataSource.query('SELECT 1');
      dbOk = true;
    } catch {}

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      database: dbOk ? 'connected' : 'disconnected',
      // Qual commit esta REALMENTE no ar. O Render injeta RENDER_GIT_COMMIT
      // sozinho, entao isto nao custa configuracao nenhuma.
      //
      // Existe porque errei tres vezes seguidas ao afirmar o que estava
      // publicado: uma pelo readyState, uma pelo CSS, e uma por pedir deploy de
      // um commit que nunca tinha sido enviado. Nenhuma delas seria possivel
      // comparando este campo com o `git rev-parse HEAD` local.
      // O slice so vale para o SHA: aplicado ao fallback ele produzia
      // "desconh", que parece um commit curto e nao avisa nada.
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'desconhecido',
    };
  }
}
