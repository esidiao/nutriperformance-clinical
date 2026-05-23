# NutriPerformance Clinical — API Reference

Base URL: `https://api.nutriperformance.com.br`

Autenticação: `Authorization: Bearer <supabase_jwt>`

---

## Tokens Consumidos por Endpoint

| Endpoint | Tokens |
|----------|--------|
| `POST /assessments/nutritional` (com IA) | 10 |
| `POST /assessments/physical` (com IA) | 5 |
| `POST /interactions/analyze` | 15 |
| `POST /bioavailability/analyze` | 12 |
| `POST /supplementation/analyze` | 8 |
| `POST /reports/generate` | 5 |
| `POST /laboratory/analyze` | 10 |
| Leitura/listagem | 0 |

---

## Endpoints Principais

### Pacientes

```
GET    /patients                    Lista pacientes do workspace
POST   /patients                    Cadastrar paciente (com consentimento LGPD)
GET    /patients/:id                Buscar paciente (audit log gerado)
PATCH  /patients/:id                Atualizar paciente
POST   /patients/:id/deletion-request  Solicitar exclusão (LGPD)
```

### Avaliações

```
POST   /assessments/nutritional             Nova avaliação nutricional
GET    /assessments/nutritional/:patientId  Histórico nutricional
POST   /assessments/physical                Nova avaliação física
GET    /assessments/physical/:patientId     Histórico físico
```

### Suplementação

```
GET    /supplementation/base         Base de suplementos (busca)
POST   /supplementation/patient      Registrar suplemento do paciente
GET    /supplementation/:patientId   Lista suplementos do paciente
POST   /supplementation/analyze      Análise de suplemento (consome tokens)
```

### Interações

```
POST   /interactions/analyze         Análise de interações (consome 15 tokens)
GET    /interactions/:patientId      Histórico de análises
```

### Biodisponibilidade

```
POST   /bioavailability/analyze      Análise (consome 12 tokens)
GET    /bioavailability/:patientId   Histórico
```

### Exames Laboratoriais

```
POST   /laboratory                   Registrar exame
GET    /laboratory/:patientId        Histórico de exames
POST   /laboratory/analyze           Análise de contexto nutricional (10 tokens)
```

### Alertas

```
GET    /alerts/:patientId            Alertas do paciente
PATCH  /alerts/:alertId/resolve      Resolver alerta
```

### Metas

```
POST   /goals                        Criar meta
GET    /goals/:patientId             Metas do paciente
POST   /goals/:goalId/checkpoint     Registrar checkpoint
```

### Relatórios

```
POST   /reports/generate             Gerar PDF (5 tokens)
GET    /reports/:patientId           Relatórios do paciente
GET    /reports/:id/download         Download do PDF (URL assinada)
```

### Tokens

```
GET    /tokens/balance               Saldo do workspace
GET    /tokens/history               Histórico de transações
GET    /tokens/costs                 Tabela de custos
```

### Pagamentos

```
POST   /billing/checkout             Criar sessão de checkout (Stripe)
POST   /billing/stripe/webhook       Webhook Stripe (raw body)
POST   /billing/mercadopago/webhook  Webhook Mercado Pago
```

### Admin

```
GET    /admin/workspaces             Lista workspaces
GET    /admin/metrics                Métricas de uso
GET    /admin/audit-logs             Logs de auditoria
PATCH  /admin/scientific-base        Atualizar base científica
GET    /admin/scientific-base/health Status da base
```

---

## Formato de Resposta de Análise IA

```json
{
  "content": "Texto da análise estruturada...",
  "confidenceLevel": "high | moderate | low | insufficient_data",
  "requiresProfessionalValidation": true,
  "disclaimer": "Esta análise é uma ferramenta de apoio...",
  "dataSource": "scientific_literature_base",
  "warnings": []
}
```

## Formato de Erro

```json
{
  "statusCode": 400,
  "message": "Saldo insuficiente. Disponível: 3 tokens. Necessário: 15 tokens.",
  "error": "Bad Request",
  "timestamp": "2026-05-22T10:30:00Z"
}
```

---

## Rate Limiting

- Endpoints de análise IA: **20 req/min** por workspace
- Endpoints de leitura: **200 req/min** por usuário
- Webhooks: sem limite (validados por assinatura)
