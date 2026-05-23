# NutriPerformance Clinical — SaaS Completo

> Plataforma integrada de apoio clínico para Nutricionistas e Profissionais de Educação Física.

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Stack Tecnológica](#stack-tecnológica)
4. [Estrutura de Pastas](#estrutura-de-pastas)
5. [Banco de Dados](#banco-de-dados)
6. [Módulos do Sistema](#módulos-do-sistema)
7. [Sistema de Tokens](#sistema-de-tokens)
8. [Segurança e LGPD](#segurança-e-lgpd)
9. [IA e Regras Anti-Alucinação](#ia-e-regras-anti-alucinação)
10. [Deploy e Infraestrutura](#deploy-e-infraestrutura)
11. [Dados de Teste](#dados-de-teste)
12. [Avisos Legais e Éticos](#avisos-legais-e-éticos)

---

## Visão Geral

**NutriPerformance Clinical** é um SaaS comercializável destinado ao apoio integrado de Nutricionistas e Profissionais de Educação Física. Atua como ferramenta de apoio técnico, analítico, documental e educacional — sem substituir a avaliação e prescrição profissional.

### O sistema NÃO substitui
- Consulta médica ou nutricional presencial
- Prescrição profissional individualizada
- Avaliação clínica e diagnóstico
- Acompanhamento multiprofissional

### O sistema atua como
- Ferramenta de apoio e organização clínica
- Análise assistida por IA com indicação de confiança
- Geração de relatórios profissionais
- Identificação de riscos e alertas para o profissional
- Apoio educacional e documental

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│   Dashboard │ Pacientes │ Avaliações │ Suplementação │ Relatórios │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS / REST + WebSocket
┌──────────────────────────────▼──────────────────────────────────┐
│                      API GATEWAY (NestJS)                        │
│   Auth │ Rate Limiting │ Token Consumption │ Audit Logging       │
└──────┬──────────┬──────────┬──────────┬────────────┬────────────┘
       │          │          │          │            │
  ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐ ┌────▼────┐
  │  Core  │ │  AI    │ │ PDF    │ │ Stripe │ │ Storage │
  │  API   │ │ Engine │ │ Engine │ │  /MP   │ │  (S3)  │
  └────┬───┘ └───┬────┘ └───┬────┘ └───┬────┘ └────┬────┘
       │         │          │          │            │
┌──────▼─────────▼──────────▼──────────▼────────────▼────────────┐
│                    PostgreSQL (Supabase)                          │
│   Patients │ Assessments │ Supplements │ Interactions │ Tokens   │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Dados
1. Profissional autentica via Supabase Auth / Clerk
2. Cada operação consome tokens do saldo do workspace
3. Análises de IA passam pelo módulo anti-alucinação antes de retornar
4. Logs de auditoria registram todas as operações sensíveis
5. Dados de pacientes são criptografados em repouso

---

## Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend | Next.js 14 (App Router) | SSR, performance, SEO |
| UI | Tailwind CSS + shadcn/ui | Design system consistente |
| Backend | NestJS (Node.js) | Modular, tipado, escalável |
| Banco | PostgreSQL via Supabase | Row-level security nativo |
| Auth | Supabase Auth | JWT + RLS integrado |
| IA | Claude API (Anthropic) | Raciocínio clínico contextual |
| Pagamentos | Stripe + Mercado Pago | Internacional + Brasil |
| PDFs | Puppeteer / React-PDF | Relatórios profissionais |
| Storage | Supabase Storage / S3 | Arquivos e exames |
| Deploy FE | Vercel | Edge network, CI/CD |
| Deploy BE | Railway | Containers gerenciados |
| Cache | Redis (Railway) | Rate limiting, sessões |
| Monitoramento | Sentry + Datadog | Erros e métricas |

---

## Estrutura de Pastas

```
nutri-performance/
├── apps/
│   ├── web/                          # Next.js Frontend
│   │   ├── app/
│   │   │   ├── (auth)/               # Login, registro, recuperação
│   │   │   ├── (dashboard)/          # Área autenticada
│   │   │   │   ├── dashboard/        # Visão geral
│   │   │   │   ├── patients/         # Gestão de pacientes
│   │   │   │   ├── assessments/      # Avaliações
│   │   │   │   │   ├── nutritional/  # Avaliação nutricional
│   │   │   │   │   └── physical/     # Avaliação física
│   │   │   │   ├── supplementation/  # Módulo suplementação
│   │   │   │   ├── interactions/     # Análise de interações
│   │   │   │   ├── bioavailability/  # Biodisponibilidade
│   │   │   │   ├── reports/          # Relatórios PDF
│   │   │   │   ├── goals/            # Metas e evolução
│   │   │   │   ├── tokens/           # Saldo e compra
│   │   │   │   └── settings/         # Configurações
│   │   │   └── api/                  # Route handlers (BFF)
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── clinical/             # Componentes clínicos
│   │   │   ├── charts/               # Gráficos de evolução
│   │   │   ├── forms/                # Formulários validados
│   │   │   └── reports/              # Templates de relatório
│   │   ├── lib/
│   │   │   ├── api-client.ts         # Cliente HTTP tipado
│   │   │   ├── validations/          # Zod schemas
│   │   │   └── utils/
│   │   └── styles/
│   │
│   └── api/                          # NestJS Backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/             # Autenticação e JWT
│       │   │   ├── users/            # Gestão de usuários
│       │   │   ├── workspaces/       # Clínicas e equipes
│       │   │   ├── patients/         # Pacientes (LGPD)
│       │   │   ├── assessments/      # Avaliações
│       │   │   │   ├── nutritional/
│       │   │   │   └── physical/
│       │   │   ├── supplementation/  # Módulo suplementos
│       │   │   ├── interactions/     # Interações clínicas
│       │   │   ├── bioavailability/  # Biodisponibilidade
│       │   │   ├── laboratory/       # Exames laboratoriais
│       │   │   ├── goals/            # Metas e acompanhamento
│       │   │   ├── reports/          # Geração de PDFs
│       │   │   ├── ai/               # Motor de IA + anti-alucinação
│       │   │   ├── tokens/           # Sistema de créditos
│       │   │   ├── billing/          # Stripe + MercadoPago
│       │   │   ├── scientific-base/  # Base científica atualizável
│       │   │   ├── alerts/           # Alertas clínicos
│       │   │   └── admin/            # Painel administrativo
│       │   ├── common/
│       │   │   ├── guards/           # Auth, roles, tokens
│       │   │   ├── interceptors/     # Logging, token consumption
│       │   │   ├── decorators/       # Roles, permissions
│       │   │   └── filters/          # Exception handling
│       │   └── database/
│       │       ├── migrations/
│       │       └── seeds/
│       └── test/
│
├── packages/
│   ├── shared-types/                 # DTOs compartilhados
│   ├── clinical-formulas/            # Fórmulas nutricionais
│   └── pdf-templates/                # Templates de relatório
│
├── docs/
│   ├── architecture/
│   ├── api/                          # OpenAPI/Swagger
│   ├── ethics/                       # Política ética
│   └── lgpd/                         # Documentação LGPD
│
└── infra/
    ├── docker/
    ├── railway/
    └── vercel/
```
