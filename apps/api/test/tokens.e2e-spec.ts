import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

/**
 * E2E test for token balance enforcement.
 * Uses a real PostgreSQL test DB (set TEST_DATABASE_URL in CI).
 * Skipped if TEST_DATABASE_URL is not set.
 */
const skipIfNoDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

skipIfNoDb('Token balance enforcement (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Dynamically import AppModule only when DB is available
    const { AppModule } = await import('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /tokens/balance returns workspace balance', async () => {
    // Requires a valid JWT in CI — use a seed user token
    const token = process.env.TEST_JWT_TOKEN ?? '';
    const res = await request(app.getHttpServer())
      .get('/tokens/balance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balance');
    expect(res.body).toHaveProperty('available');
  });
});
