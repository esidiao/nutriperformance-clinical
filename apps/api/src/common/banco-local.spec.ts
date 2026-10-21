import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  podeSincronizar, motivoDeNaoSincronizar, hospedeiroDaUrl, hospedeiroEhLocal,
} from './banco-local';

/**
 * CATRACA sobre um comportamento que já foi observado.
 *
 * Em 21/10/2026, subindo a API em modo dev, o TypeORM tentou derrubar as
 * chaves estrangeiras de users, patients, audit_logs,
 * nutritional_assessments e mais uma dúzia de tabelas, e remover
 * `physical_assessments.secondary_goals`.
 *
 * O destino era o banco LOCAL, então não houve dano em produção. O que torna
 * isso um defeito, e não um susto, é que a guarda era
 * `synchronize: !isProduction` — decidia pelo NODE_ENV, não pelo destino.
 * Com `DATABASE_URL` de produção e `NODE_ENV=development`, exatamente a mesma
 * sequência de ALTER rodaria contra produção. A única coisa separando os dois
 * cenários era o valor de uma variável de ambiente.
 */
describe('guarda do synchronize', () => {
  describe('reconhecimento de hospedeiro', () => {
    it('reconhece os locais', () => {
      for (const h of ['localhost', '127.0.0.1', '::1', '0.0.0.0', 'db.localhost', 'LOCALHOST']) {
        expect(hospedeiroEhLocal(h)).toBe(true);
      }
    });

    it('NÃO reconhece os remotos', () => {
      for (const h of [
        'db.abcdefgh.supabase.co',
        'aws-0-sa-east-1.pooler.supabase.com',
        'nutriperformance-clinical.onrender.com',
        'localhost.atacante.com', // o sufixo é que importa, não o prefixo
        '10.0.0.5',
        '192.168.1.10',          // rede local NÃO é a máquina local
      ]) {
        expect(hospedeiroEhLocal(h)).toBe(false);
      }
    });

    it('vazio e nulo não são locais', () => {
      for (const h of [null, undefined, '', '   ']) {
        expect(hospedeiroEhLocal(h)).toBe(false);
      }
    });

    it('extrai o hospedeiro da URL de conexão', () => {
      expect(hospedeiroDaUrl('postgres://u:s@localhost:5432/db')).toBe('localhost');
      expect(hospedeiroDaUrl('postgresql://u:s@db.xyz.supabase.co:5432/postgres'))
        .toBe('db.xyz.supabase.co');
    });

    it('URL que não dá para interpretar vira null, não "parece local"', () => {
      // Na dúvida, remoto. Errar para o lado de não sincronizar custa uma
      // migração escrita à mão; errar para o outro custa o banco.
      expect(hospedeiroDaUrl('nao é uma url')).toBeNull();
      expect(hospedeiroDaUrl('')).toBeNull();
      expect(hospedeiroDaUrl(undefined)).toBeNull();
    });
  });

  describe('a decisão', () => {
    it('o caso que aconteceu: dev apontando para produção NÃO sincroniza', () => {
      expect(podeSincronizar({
        nodeEnv: 'development',
        databaseUrl: 'postgresql://postgres:s@db.abcdefgh.supabase.co:5432/postgres',
      })).toBe(false);
    });

    it('dev com banco local sincroniza', () => {
      expect(podeSincronizar({
        nodeEnv: 'development',
        databaseUrl: 'postgres://postgres:postgres@localhost:5432/nutri',
      })).toBe(true);
      expect(podeSincronizar({ nodeEnv: 'development', dbHost: 'localhost' })).toBe(true);
    });

    it('produção NUNCA sincroniza, nem com banco local', () => {
      expect(podeSincronizar({
        nodeEnv: 'production',
        databaseUrl: 'postgres://u:s@localhost:5432/db',
      })).toBe(false);
    });

    it('sem destino reconhecível, NÃO sincroniza', () => {
      expect(podeSincronizar({ nodeEnv: 'development' })).toBe(false);
      expect(podeSincronizar({ nodeEnv: 'development', databaseUrl: 'lixo' })).toBe(false);
      expect(podeSincronizar({})).toBe(false);
    });

    it('a URL tem precedência sobre DB_HOST', () => {
      // DATABASE_URL é o que o app usa quando existe; um DB_HOST local
      // sobrando no .env não pode autorizar a sincronização.
      expect(podeSincronizar({
        nodeEnv: 'development',
        databaseUrl: 'postgres://u:s@db.xyz.supabase.co:5432/postgres',
        dbHost: 'localhost',
      })).toBe(false);
    });
  });

  describe('o motivo, que vai para o log do boot', () => {
    it('explica cada recusa', () => {
      expect(motivoDeNaoSincronizar({ nodeEnv: 'production' })).toMatch(/production/);
      expect(motivoDeNaoSincronizar({
        nodeEnv: 'development',
        databaseUrl: 'postgres://u:s@db.xyz.supabase.co:5432/p',
      })).toMatch(/db\.xyz\.supabase\.co/);
      expect(motivoDeNaoSincronizar({ nodeEnv: 'development' }))
        .toMatch(/não foi possível identificar/);
    });

    it('quando sincroniza, não há motivo a explicar', () => {
      expect(motivoDeNaoSincronizar({
        nodeEnv: 'development', dbHost: 'localhost',
      })).toBeNull();
    });
  });

  describe('o app.module usa a guarda', () => {
    const fonte = readFileSync(join(__dirname, '..', 'app.module.ts'), 'utf8');

    it('não voltou a decidir por NODE_ENV', () => {
      // Esta é a linha exata que causou o incidente.
      expect(fonte).not.toContain('synchronize: !isProduction');
    });

    it('usa `podeSincronizar`', () => {
      expect(fonte).toContain('podeSincronizar');
      expect(fonte).toMatch(/synchronize:\s*sincronizar/);
    });
  });
});
