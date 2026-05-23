# NutriPerformance Clinical — Guia de Deploy

## Pré-requisitos

- Node.js 20+
- pnpm 9+
- Conta Supabase
- Conta Vercel
- Conta Railway
- Conta Anthropic (Claude API)
- Conta Stripe e/ou Mercado Pago

---

## 1. Banco de Dados (Supabase)

```bash
# 1. Criar projeto no Supabase
# https://supabase.com/dashboard → New Project

# 2. Executar schema
psql $DATABASE_URL < docs/database-schema.sql

# 3. Executar seed de teste (opcional)
psql $DATABASE_URL < docs/seed-data.sql

# 4. Habilitar extensões (já incluído no schema)
# uuid-ossp, pgcrypto, pg_trgm

# 5. Configurar autenticação no Supabase Dashboard:
# Authentication → Providers → Email (habilitado)
# Authentication → URL Configuration → Site URL: https://seu-dominio.com
```

### Variáveis do Supabase
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # apenas no backend
DATABASE_URL=postgresql://...
```

---

## 2. Backend (Railway)

```bash
# 1. Criar projeto no Railway
# https://railway.app → New Project → Deploy from GitHub

# 2. Configurar variáveis de ambiente no Railway:
```

### Variáveis de Ambiente — Backend (NestJS)

```env
# Banco
DATABASE_URL=postgresql://postgres:[senha]@[host]:5432/postgres

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# IA
ANTHROPIC_API_KEY=sk-ant-...

# Pagamentos
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...

# Storage
SUPABASE_STORAGE_BUCKET=nutriperformance-docs

# JWT
JWT_SECRET=gere-um-segredo-forte-aqui
JWT_EXPIRY=7d

# Redis (Railway Redis addon)
REDIS_URL=redis://...

# App
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://app.nutriperformance.com.br

# Criptografia dados sensíveis
ENCRYPTION_KEY=32-bytes-hex-key-aqui  # openssl rand -hex 32
ENCRYPTION_IV_LENGTH=16

# Sentry (monitoramento)
SENTRY_DSN=https://...
```

```bash
# 3. Deploy
railway up

# 4. Executar migrations
railway run npx typeorm migration:run
```

---

## 3. Frontend (Vercel)

```bash
# 1. Push para GitHub
git push origin main

# 2. Importar no Vercel
# https://vercel.com → Import Project → GitHub

# 3. Configurar variáveis de ambiente no Vercel:
```

### Variáveis de Ambiente — Frontend (Next.js)

```env
# API Backend
NEXT_PUBLIC_API_URL=https://api.nutriperformance.com.br

# Supabase (anon key apenas)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Stripe (chave pública)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# App
NEXT_PUBLIC_APP_URL=https://app.nutriperformance.com.br
NEXT_PUBLIC_APP_NAME=NutriPerformance Clinical
```

---

## 4. Configuração de Domínios

```
app.nutriperformance.com.br  → Vercel (Frontend)
api.nutriperformance.com.br  → Railway (Backend)
```

No Vercel: Settings → Domains → Add domain
No Railway: Settings → Networking → Custom Domain

---

## 5. Webhooks

### Stripe
```bash
# Cadastrar endpoint no Stripe Dashboard:
# Developers → Webhooks → Add endpoint
# URL: https://api.nutriperformance.com.br/billing/stripe/webhook
# Eventos: payment_intent.succeeded, customer.subscription.*
```

### Mercado Pago
```bash
# Cadastrar no painel MP:
# URL: https://api.nutriperformance.com.br/billing/mercadopago/webhook
```

---

## 6. Configuração de Storage (Supabase)

```sql
-- Criar buckets no Supabase Storage
INSERT INTO storage.buckets (id, name, public) VALUES
  ('lab-exams', 'lab-exams', false),      -- PDFs de exames
  ('reports', 'reports', false),           -- Relatórios gerados
  ('avatars', 'avatars', true);            -- Fotos de perfil

-- Políticas de acesso (via Supabase Dashboard ou SQL)
-- lab-exams: apenas usuários do mesmo workspace
-- reports: apenas criador e profissionais do paciente
```

---

## 7. Inicialização Local (Desenvolvimento)

```bash
# Clonar repositório
git clone https://github.com/sua-org/nutri-performance.git
cd nutri-performance

# Instalar dependências
pnpm install

# Copiar e configurar variáveis
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Editar os arquivos com suas chaves

# Subir banco local (Docker)
docker-compose up -d postgres redis

# Executar migrations
cd apps/api && npx typeorm migration:run

# Seed de dados de teste
psql $DATABASE_URL < ../../docs/seed-data.sql

# Iniciar backend
cd apps/api && pnpm dev

# Iniciar frontend (nova aba)
cd apps/web && pnpm dev

# Acessar
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# API Docs: http://localhost:3001/api/docs (Swagger)
```

---

## 8. Checklist de Produção

### Segurança
- [ ] HTTPS forçado em todos os endpoints
- [ ] Chaves de API em variáveis de ambiente (nunca no código)
- [ ] `ENCRYPTION_KEY` gerada com `openssl rand -hex 32`
- [ ] RLS habilitado em todas as tabelas sensíveis
- [ ] Rate limiting configurado (100 req/min por IP)
- [ ] Headers de segurança (CSP, HSTS, etc.) configurados no Next.js
- [ ] Backups automáticos habilitados no Supabase

### LGPD
- [ ] Política de Privacidade publicada
- [ ] Termos de Uso publicados
- [ ] Fluxo de consentimento implementado e testado
- [ ] DPO configurado (email dpo@...)
- [ ] Processo de exclusão de dados testado

### Performance
- [ ] Redis configurado para cache de sessões e rate limiting
- [ ] Índices do banco verificados com EXPLAIN ANALYZE
- [ ] Edge functions da Vercel habilitadas

### Monitoramento
- [ ] Sentry configurado (frontend e backend)
- [ ] Alertas de erro configurados
- [ ] Alertas de saldo de tokens configurados

---

## 9. Comandos Úteis

```bash
# Gerar nova migration
cd apps/api && npx typeorm migration:generate src/database/migrations/NomeDaMigration

# Reverter última migration
npx typeorm migration:revert

# Verificar saúde da API
curl https://api.nutriperformance.com.br/health

# Logs em produção (Railway)
railway logs --tail

# Verificar uso de tokens de um workspace
psql $DATABASE_URL -c "SELECT * FROM token_transactions WHERE workspace_id = '...' ORDER BY created_at DESC LIMIT 20;"
```
