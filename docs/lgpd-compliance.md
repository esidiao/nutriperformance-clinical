# NutriPerformance Clinical — Conformidade LGPD

## Base Legal (Art. 7º e 11º, Lei 13.709/2018)

O tratamento de dados no NutriPerformance Clinical é fundamentado em:

- **Consentimento** (Art. 7º, I): coletado de forma livre, informada e inequívoca
- **Legítimo interesse do titular** (Art. 7º, IX): dados fornecidos pelo próprio paciente ao profissional
- **Proteção da saúde** (Art. 11º, II, f): dados de saúde tratados exclusivamente por profissionais habilitados
- **Exercício regular de direitos** (Art. 7º, VI): manutenção de prontuários e registros profissionais

---

## Categorias de Dados Tratados

### Dados Comuns
| Dado | Finalidade | Retenção |
|------|-----------|----------|
| Email | Autenticação, comunicação | Até exclusão da conta |
| Nome | Identificação do usuário profissional | Até exclusão da conta |
| Registro profissional | Validação de habilitação | Até exclusão da conta |

### Dados Sensíveis (Art. 5º, II)
| Dado | Finalidade | Proteção |
|------|-----------|---------|
| Dados de saúde do paciente | Acompanhamento clínico | Criptografia AES-256 em repouso |
| Composição corporal | Avaliação física | Criptografia AES-256 em repouso |
| Medicamentos em uso | Análise de interações | Criptografia AES-256 em repouso |
| Condições clínicas | Análise de risco | Criptografia AES-256 em repouso |
| Exames laboratoriais | Contexto nutricional | Criptografia AES-256 em repouso + arquivos no Storage criptografado |

---

## Medidas Técnicas de Proteção

### Criptografia
- Dados de identificação pessoal: criptografia AES-256 (coluna `*_encrypted`)
- CPF: armazenado apenas como hash SHA-256 para busca (não reversível)
- Senhas: gerenciadas pelo Supabase Auth (bcrypt + salt)
- Comunicação: TLS 1.3 obrigatório
- Backups: criptografados com chave gerenciada separadamente

### Controle de Acesso
- Row Level Security (RLS) no PostgreSQL via Supabase
- Isolamento por workspace (profissionais não veem dados de outras clínicas)
- Acesso a pacientes restrito aos profissionais vinculados
- Perfis de permissão por role (admin, nutricionista, educador físico, estudante)
- MFA obrigatório para perfis com acesso a dados sensíveis

### Auditoria
- Todos os acessos a dados de pacientes são registrados em `audit_logs`
- Logs particionados por ano, retidos por 5 anos
- Logs incluem: usuário, IP, ação, recurso, timestamp
- Logs NÃO incluem conteúdo dos dados (apenas metadados)

---

## Direitos dos Titulares (Art. 18)

### Interface de Exercício de Direitos
O sistema disponibiliza no portal do paciente (via profissional responsável):

| Direito | Como exercer | Prazo de resposta |
|---------|-------------|-------------------|
| Confirmação de tratamento | Painel do paciente | Imediato |
| Acesso aos dados | Exportação via profissional | 15 dias |
| Correção | Edição via profissional | 10 dias |
| Anonimização | Solicitação via settings | 15 dias |
| Portabilidade | Exportação JSON/PDF | 15 dias |
| Eliminação | Solicitação via settings | 30 dias |
| Revogação de consentimento | Toggle no sistema | Imediato |
| Informação sobre compartilhamento | FAQ e política de privacidade | Imediato |

### Processo de Exclusão de Dados
1. Paciente ou profissional solicita exclusão
2. Sistema registra `data_deletion_requested_at`
3. Dados identificadores são anonimizados em até 30 dias
4. Dados não-identificadores (estatísticas agregadas) podem ser mantidos
5. Logs de auditoria são mantidos pelo prazo legal

---

## Consentimento

### Coleta
- Checkbox explícito no primeiro acesso do paciente ao sistema
- Linguagem simples, sem jargão técnico
- Possibilidade de ler a política completa antes de aceitar
- Registro de: consentimento, data/hora, IP, versão da política

### Modelo de Consentimento
```
Autorizo o [Nome da Clínica/Profissional] a registrar e tratar meus dados 
de saúde no sistema NutriPerformance Clinical para fins de acompanhamento 
nutricional e/ou físico. Meus dados são protegidos conforme a LGPD 
(Lei 13.709/2018) e não serão compartilhados com terceiros sem meu 
consentimento. Posso revogar esta autorização a qualquer momento.
```

---

## Compartilhamento de Dados

### Não compartilhamos dados com terceiros, exceto:
- **Stripe/Mercado Pago**: dados de pagamento (PCI-DSS compliance, sem dados de saúde)
- **Supabase**: infraestrutura de banco de dados (DPA assinado, servidores no Brasil/EUA)
- **Anthropic (Claude API)**: textos enviados para análise de IA (sem dados identificadores do paciente — apenas dados clínicos anonimizados)
- **Vercel/Railway**: hospedagem (sem acesso a dados de pacientes)

### Dados enviados à API de IA
**Nunca enviamos à API Claude:**
- Nome do paciente
- CPF, email, telefone
- Endereço

**Enviamos apenas:**
- Dados clínicos anonimizados (idade, gênero, condições, medicamentos, suplementos)
- Sem identificadores pessoais

---

## Encarregado de Dados (DPO)

- Nome: [A definir no contrato]
- Email: dpo@nutriperformance.com.br
- Disponível para: titulares, ANPD, parceiros

---

## Incidentes de Segurança

### Protocolo
1. Detecção → notificação interna em 2h
2. Avaliação de impacto em 12h
3. Notificação à ANPD em até 72h (se risco relevante)
4. Notificação aos titulares afetados em até 72h

---

## Retenção de Dados

| Dado | Retenção | Base |
|------|---------|------|
| Prontuários e avaliações | 20 anos após último acesso | Resolução CFN 565/2019 |
| Logs de auditoria | 5 anos | Segurança e conformidade |
| Dados financeiros | 5 anos | Lei 6.404/76 |
| Dados de acesso | 6 meses | Padrão segurança |
| Dados excluídos a pedido | 30 dias para anonimização | LGPD Art. 18 |
