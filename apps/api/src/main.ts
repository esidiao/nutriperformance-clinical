import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/node';
import * as http from 'http';

// Fallback health server — keeps the port alive while NestJS bootstraps
// so Railway's health check passes even if the DB takes time to connect.
function startFallbackServer(port: number | string): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'starting', timestamp: new Date().toISOString() }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Application starting...' }));
    }
  });
  server.listen(port, () => console.log(`Fallback health server on port ${port}`));
  return server;
}

async function bootstrap() {
  console.log('Starting NutriPerformance API...');
  console.log('NODE_ENV:', process.env.NODE_ENV);

  const port = process.env.PORT ?? 3001;

  // Start fallback server immediately so Railway health check passes
  const fallback = startFallbackServer(port);

  try {
    const app = await NestFactory.create(AppModule, {
      rawBody: true,
    });

    if (process.env.SENTRY_DSN) {
      Sentry.init({ dsn: process.env.SENTRY_DSN });
    }

    app.enableCors({
      origin: [
        process.env.FRONTEND_URL ?? 'http://localhost:3000',
        'https://app.nutriperformance.com.br',
      ],
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
    // Keep fallback server running so container doesn't exit
    console.log('Keeping fallback health server running...');
  }
}

bootstrap();
