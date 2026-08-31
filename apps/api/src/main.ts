import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import * as Sentry from '@sentry/node';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import * as http from 'http';

// Servidor de fallback — mantém a porta viva enquanto o NestJS sobe, para que
// o health check da plataforma não derrube o deploy só porque o banco demorou.
//
// `state` distingue "subindo" de "falhou". Enquanto era sempre 200, um bootstrap
// que estourava deixava este servidor no ar respondendo 200 em /health para
// sempre: o Render (healthCheckPath: /health) marcava como saudável um serviço
// que não tem uma única rota da API de pé — a falha ficava invisível.
function startFallbackServer(port: number | string, state: { failed: boolean }): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      const code = state.failed ? 503 : 200;
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: state.failed ? 'failed' : 'starting',
        timestamp: new Date().toISOString(),
      }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: state.failed ? 'Application failed to start' : 'Application starting...' }));
    }
  });
  server.listen(port, () => console.log(`Fallback health server on port ${port}`));
  return server;
}

async function bootstrap() {
  console.log('Starting NutriPerformance API...');
  console.log('NODE_ENV:', process.env.NODE_ENV);

  const port = process.env.PORT ?? 3001;

  // Antes do NestFactory: inicializado só depois, uma falha de bootstrap (o
  // caso que mais interessa reportar) acontecia com o Sentry ainda desligado.
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN });
  }

  // Sobe o fallback imediatamente para o health check da plataforma passar
  const bootState = { failed: false };
  let fallback = startFallbackServer(port, bootState);

  try {
    const app = await NestFactory.create(AppModule, {
      rawBody: true,
    });

    app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }));

    // A anamnese por áudio envia a gravação da consulta em base64; o teto padrão
    // do Express (100 kB) rejeitaria qualquer gravação com mais de alguns segundos.
    app.use(json({ limit: '25mb' }));
    app.use(urlencoded({ limit: '25mb', extended: true }));

    app.useGlobalFilters(new GlobalExceptionFilter());

    // CORS — permite localhost (dev), o domínio de produção e qualquer
    // deployment da Vercel do projeto (as URLs mudam a cada deploy).
    const staticOrigins = [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'http://localhost:3000',
      'https://app.nutriperformance.com.br',
      // Domínio fixo de produção na Vercel + alias de produção
      'https://nutriperformance-clinical.vercel.app',
      'https://web-ashy-two-76.vercel.app',
    ];
    app.enableCors({
      origin: (origin, callback) => {
        // Requests sem origin (curl, health checks, server-to-server) são permitidos
        if (!origin) return callback(null, true);
        const isAllowed =
          staticOrigins.includes(origin) ||
          // Deployments da Vercel do projeto: web-*.vercel.app
          /^https:\/\/web-[a-z0-9-]+-sidiao-collabs-projects\.vercel\.app$/.test(origin) ||
          // Domínio de produção e subdomínios nutriperformance.com.br
          /^https:\/\/([a-z0-9-]+\.)?nutriperformance\.com\.br$/.test(origin);
        callback(null, isAllowed);
      },
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    if (process.env.NODE_ENV === 'development') {
      const config = new DocumentBuilder()
        .setTitle('NutriPerformance Clinical API')
        .setDescription('API do SaaS NutriPerformance Clinical')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
    }

    // Close fallback server before NestJS starts listening
    await new Promise<void>(resolve => fallback.close(() => resolve()));

    await app.listen(port);
    console.log(`NutriPerformance Clinical API rodando na porta ${port}`);
  } catch (err) {
    console.error('Failed to start NestJS app:', err);
    Sentry.captureException(err);
    // O container segue de pé (evita crash-loop), mas /health passa a responder
    // 503 — a plataforma precisa enxergar o serviço como degradado, não OK.
    bootState.failed = true;
    // Se a falha foi no `app.listen`, o fallback já tinha sido fechado logo
    // acima e ninguém estaria escutando a porta: reabre para responder 503.
    if (!fallback.listening) fallback = startFallbackServer(port, bootState);
    console.log('Keeping fallback health server running (agora respondendo 503 em /health)...');
  }
}

bootstrap();
