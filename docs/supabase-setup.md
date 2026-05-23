# Subindo para o Supabase — Passo a Passo

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New project**
2. Escolha nome, senha do banco e região (recomendado: `sa-east-1` — São Paulo)
3. Aguarde o provisionamento (~2 min)

Colete estes valores em **Settings → API**:

| Variável                        | Onde encontrar                              |
|---------------------------------|---------------------------------------------|
| `SUPABASE_URL`                  | Project URL                                 |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project URL (igual ao acima)                |
| `SUPABASE_ANON_KEY`             | anon / public key                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | service_role key (**nunca exponha no front**) |
| `SUPABASE_JWT_SECRET`           | Settings → API → JWT Secret                 |

Em **Settings → Database → Connection string → URI**:

| Variável       | Onde encontrar                    |
|----------------|-----------------------------------|
| `DATABASE_URL` | URI mode (com `?pgbouncer=true` se usar pooler) |

---

## 2. Rodar o schema

No **SQL Editor** do Supabase, cole e execute o arquivo completo:

```
docs/database-schema.sql
```

> ⚠️ Execute uma única vez. Se precisar recriar, rode o script abaixo antes:
> ```sql
> -- CUIDADO: apaga tudo. Só use em dev/staging.
> DROP SCHEMA public CASCADE;
> CREATE SCHEMA public;
> ```

Verifique no **Table Editor** que apareceram as tabelas:
`workspaces`, `users`, `patients`, `nutritional_assessments`, `physical_assessments`,
`laboratory_exams`, `patient_supplementation`, `interaction_analyses`,
`bioavailability_analyses`, `clinical_alerts`, `patient_goals`, `token_transactions` etc.

---

## 3. Rodar o seed de dados de teste (opcional)

Apenas em ambiente de **desenvolvimento ou staging**:

```
docs/seed-data.sql
```

Isso cria:
- 2 workspaces de teste
- 4 usuários (nutricionista, educador físico, admin, estudante)
- 1 paciente com avaliações e suplementação
- Catálogo de suplementos com interações
- Histórico de tokens

---

## 4. Configurar Authentication no Supabase

Em **Authentication → Settings**:

- **Site URL**: `http://localhost:3000` (dev) ou seu domínio de produção
- **Redirect URLs**: adicionar `http://localhost:3000/**` e `https://seu-dominio.com/**`
- **Email confirmations**: desabilitar em dev para facilitar testes

Em **Authentication → Email Templates**, personalize os e-mails de convite com a marca NutriPerformance.

---

## 5. Configurar Storage

Em **Storage → New bucket**:

- Nome: `nutriperformance-docs`
- Public: **NÃO** (privado)
- File size limit: 10 MB
- Allowed MIME types: `application/pdf,image/*`

Política de acesso (RLS no bucket):
```sql
-- Usuários autenticados só acessam arquivos do próprio workspace
CREATE POLICY "workspace_storage_access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'nutriperformance-docs'
  AND (storage.foldername(name))[1] = (
    SELECT workspace_id::text FROM users
    WHERE auth_id = auth.uid()::text LIMIT 1
  )
);
```

---

## 6. Criar os arquivos `.env`

### Backend — `apps/api/.env`
```bash
cp apps/api/.env.example apps/api/.env
```

Preencher:
```env
DATABASE_URL=postgresql://postgres:[SENHA]@db.[PROJECT-REF].supabase.co:5432/postgres

SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # NÃO commitar
SUPABASE_JWT_SECRET=seu-jwt-secret-do-supabase

ANTHROPIC_API_KEY=sk-ant-api03-...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Gerar com: openssl rand -hex 32
ENCRYPTION_KEY=64_chars_hex_aqui
# Gerar com: openssl rand -hex 16
CPF_SALT=32_chars_hex_aqui

NODE_ENV=production
PORT=3001
FRONTEND_URL=https://seu-dominio.com
```

### Frontend — `apps/web/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # chave anon (pode expor no front)
NEXT_PUBLIC_API_URL=https://api.seu-dominio.com
```

---

## 7. Instalar dependências e testar localmente

```bash
cd NutriPerformance

# Instalar todas as dependências (monorepo)
pnpm install

# Subir banco local com Docker (opcional — ou usar Supabase diretamente)
docker-compose -f infra/docker/docker-compose.yml up -d

# Subir API + Web em paralelo
pnpm dev
```

Acesse:
- Frontend: http://localhost:3000
- API: http://localhost:3001
- Swagger (somente dev): http://localhost:3001/api/docs

---

## 8. Deploy em produção

### Backend → Railway

1. Conecte o repositório no [railway.app](https://railway.app)
2. Selecione o serviço `apps/api`
3. Configure as variáveis de ambiente (todas do `.env` acima)
4. Railway detecta `package.json` com `"start": "node dist/main"` automaticamente
5. Configure domínio customizado em **Settings → Networking**

### Frontend → Vercel

1. Importe o repositório no [vercel.com](https://vercel.com)
2. Root directory: `apps/web`
3. Framework preset: **Next.js**
4. Adicione as variáveis `NEXT_PUBLIC_*` em **Project Settings → Environment Variables**
5. Adicione também `NEXT_PUBLIC_API_URL` apontando para o domínio do Railway

---

## 9. Configurar Stripe Webhook

Após o deploy do backend:

```bash
# Instalar CLI do Stripe
stripe listen --forward-to https://api.seu-dominio.com/billing/stripe/webhook

# Ou configurar no Dashboard do Stripe:
# Developers → Webhooks → Add endpoint
# URL: https://api.seu-dominio.com/billing/stripe/webhook
# Eventos: payment_intent.succeeded, invoice.payment_succeeded,
#          customer.subscription.updated, customer.subscription.deleted
```

Copiar o `Signing secret` → `STRIPE_WEBHOOK_SECRET`

---

## 10. Verificação final

```sql
-- Checar RLS habilitado em todas as tabelas sensíveis
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Checar políticas criadas
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Checar extensões
SELECT extname FROM pg_extension;
```

Resultado esperado: `uuid-ossp`, `pgcrypto`, `pg_trgm` instaladas; 63 políticas; `rowsecurity = true` em todas as tabelas sensíveis.

---

## Segurança — Checklist obrigatório antes de ir para produção

- [ ] `ENCRYPTION_KEY` gerada com `openssl rand -hex 32` (nunca reutilizar entre ambientes)
- [ ] `CPF_SALT` gerada com `openssl rand -hex 16`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` presente **apenas** no backend, nunca no frontend
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` é a única chave Supabase exposta no frontend
- [ ] `.env` e `.env.local` estão no `.gitignore`
- [ ] RLS verificado com usuário de teste (ver seção 10)
- [ ] Stripe webhook com `STRIPE_WEBHOOK_SECRET` configurado
- [ ] `NODE_ENV=production` no backend (desativa Swagger)
- [ ] CORS configurado com domínio real em `main.ts`
