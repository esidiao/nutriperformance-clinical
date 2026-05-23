# NutriPerformance Clinical — Conformidade Ética e Normativa

## Normas Observadas

| Órgão | Norma | Aplicação no sistema |
|-------|-------|---------------------|
| CFN | Código de Ética do Nutricionista (Resolução CFN 599/2018) | Limites de atuação do nutricionista no sistema |
| CFN | Resolução CFN 600/2018 — Atribuições do nutricionista | Módulos disponíveis por perfil |
| CONFEF | Código de Ética do Profissional de Educação Física | Limites de atuação do educador físico |
| CONFEF/CREF | Resolução 046/2002 | Avaliação física |
| CFM | Código de Ética Médica | Delimitação do que NÃO é atribuição do sistema |
| ANVISA | RDC 786/2023 — Suplementos alimentares | Classificação e alertas de suplementação |
| LGPD | Lei 13.709/2018 | Tratamento de dados de saúde |

---

## Limites por Perfil de Usuário

### Nutricionista

**PODE usar no sistema:**
- Avaliação e diagnóstico nutricional
- Cálculo de necessidades energéticas e de macronutrientes
- Elaboração de estratégias alimentares
- Análise e prescrição de suplementos nutricionais (dentro das atribuições legais)
- Análise de exames laboratoriais para contexto nutricional
- Geração de relatórios nutricionais com assinatura e registro CFN
- Análise de biodisponibilidade nutricional
- Avaliação de interações alimentares e de suplementos

**NÃO pode usar no sistema para:**
- Diagnóstico de doenças (exclusivo médico)
- Prescrição de medicamentos
- Interpretação diagnóstica de exames (apenas contexto nutricional)
- Avaliação de aptidão física (exclusivo educador físico)

---

### Profissional de Educação Física

**PODE usar no sistema:**
- Avaliação física e de composição corporal
- Prescrição de exercícios (registro e acompanhamento)
- Avaliação de desempenho e condicionamento
- Acompanhamento de metas físicas
- Visualização de alertas nutricionais relevantes para o treino
- Visualização de riscos de suplementação relacionados ao exercício
- Geração de relatórios de avaliação física com assinatura e registro CONFEF/CREF

**NÃO pode usar no sistema para:**
- Diagnóstico nutricional ou clínico
- Prescrição de dietas ou suplementos (exceto orientação geral dentro de suas atribuições)
- Interpretação de exames médicos
- Alegações terapêuticas

**Controle técnico:**
- Interface do educador físico não exibe módulos de diagnóstico nutricional clínico
- Campos de diagnóstico nutricional são somente-leitura para educadores físicos
- Sistema bloqueia geração de relatórios nutricionais por educadores físicos

---

### Estudante Supervisionado

**PODE:**
- Registrar avaliações (como rascunho)
- Visualizar análises de IA
- Aprender com casos (em modo educacional)

**NÃO PODE:**
- Finalizar e assinar relatórios (requer supervisor)
- Gerar PDFs assinados
- Acessar módulos de prescrição sem revisão do supervisor

---

## Regras de Suplementação — Limites Éticos

### O sistema NUNCA sugere ou apoia:
- Anabolizantes esteroides (substâncias proibidas pela ANVISA sem prescrição médica)
- Hormônios ou análogos hormonais
- Substâncias proibidas pelo Código Mundial Antidoping (WADA)
- Práticas de cutting extremo ou restrição calórica perigosa
- Protocolos de uso off-label sem evidência
- Suplementação indiscriminada sem objetivo definido
- Promessas de resultados estéticos garantidos

### O sistema sempre:
- Indica nível de evidência científica
- Indica nível de risco
- Recomenda validação profissional
- Alerta para necessidade de revisão médica quando pertinente
- Informa quando evidência é insuficiente
- Cita possíveis contraindicações por condição clínica

---

## Alertas Clínicos Obrigatórios

O sistema gera automaticamente alertas quando detecta:

| Condição | Alerta | Nível |
|----------|--------|-------|
| Termogênico + arritmia diagnosticada | Contraindicação | Crítico |
| Cafeína > 400mg/dia | Risco cardiovascular | Alto |
| Vitamina K + anticoagulante | Interação farmacológica | Alto |
| Creatina + doença renal crônica avançada | Risco renal | Alto |
| Pré-treino + hipertensão não controlada | Risco cardiovascular | Moderado |
| Hipericão + qualquer medicamento | Indução de CYP3A4 | Moderado |
| Ferro + IBP | Redução de absorção | Moderado |
| IMC < 17 (adultos) | Possível desnutrição grave | Alto |
| Perda > 1,5 kg/semana | Risco de perda de massa magra | Moderado |
| Ingestão < 1200 kcal/dia (mulheres) | Risco de deficiências | Alto |
| Ingestão calórica muito baixa + alta atividade | Possível RED-S | Alto |
| Proteína > 3g/kg em doença renal | Risco de sobrecarga renal | Crítico |

---

## Aviso Legal Automático em Todos os Relatórios

```
AVISO LEGAL

Este relatório foi gerado pelo sistema NutriPerformance Clinical, 
ferramenta digital de apoio profissional.

NÃO constitui:
• Diagnóstico médico
• Prescrição terapêutica
• Tratamento clínico
• Substituição de consulta presencial

Deve ser:
• Interpretado exclusivamente pelo profissional de saúde habilitado
• Considerado em conjunto com a avaliação clínica individualizada
• Validado pelo profissional responsável pelo paciente

Responsabilidade clínica: exclusiva do profissional responsável.
Regulamentação: CFN (Resolução 599/2018), CONFEF, LGPD (Lei 13.709/2018).
```

---

## Módulo Anti-Alucinação — Regras Hard-Coded

As seguintes regras são aplicadas **antes** de qualquer resposta da IA:

```typescript
const FORBIDDEN_OUTPUTS = [
  'prescrevo',           // jamais prescrição
  'diagnóstico definitivo',
  'certamente causa',
  'garanto que',
  'anabolizante',        // substância proibida
  'esteroide anabólico',
  'resultado garantido',
  'cura',
  'trata definitivamente',
];

// Se detectado, resposta é bloqueada e substituída por:
const FALLBACK_RESPONSE = 
  'Dados insuficientes para conclusão segura. ' +
  'Esta análise requer validação do profissional responsável.';
```

---

## Atualização da Base Científica

- Base científica revisada a cada **90 dias**
- Alertas automáticos gerados quando base não é atualizada por 90 dias
- Referências indicam: fonte, tipo de evidência, ano, grau de recomendação
- Nunca são usadas referências com mais de 10 anos sem revisão para interações críticas
- Profissionais são notificados quando diretrizes relevantes são atualizadas
