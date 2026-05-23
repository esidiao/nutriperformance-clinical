import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/node';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Necessário para validação de assinatura de webhooks (Stripe)
    rawBody: true,
  });

  // Sentry — monitoramento de erros em produção
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN });
  }

  // CORS — apenas origens autorizadas
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'https://app.nutriperformance.com.br',
    ],
    credentials: true,
  });

  // Validação global de DTOs (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Remove campos não declarados no DTO
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger — documentação interativa (apenas em dev/staging)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NutriPerformance Clinical API')
      .setDescription(
        'API do SaaS NutriPerformance Clinical — ferramenta de apoio para Nutricionistas e Profissionais de Educação Física.\n\n' +
        '**AVISO:** Este sistema é ferramenta de apoio profissional. Não substitui avaliação clínica, diagnóstico ou prescrição.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('patients', 'Gestão de pacientes (LGPD)')
      .addTag('assessments', 'Avaliações nutricional e física')
      .addTag('supplementation', 'Módulo de suplementação')
      .addTag('interactions', 'Análise de interações clínicas')
      .addTag('bioavailability', 'Análise de biodisponibilidade')
      .addTag('alerts', 'Alertas clínicos automáticos')
      .addTag('reports', 'Geração de relatórios PDF')
      .addTag('tokens', 'Sistema de tokens/créditos')
      .addTag('billing', 'Pagamentos e assinaturas')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`NutriPerformance Clinical API rodando na porta ${port}`);
}

bootstrap();
