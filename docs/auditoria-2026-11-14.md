# Auditoria NutriPerformance Clinical — 14/11/2026

Base: `master` em `ddefbdb`, árvore limpa. API em produção no commit `75fd221`.

> **Versão em página:** <https://claude.ai/artifact/9PNiMiXFP2KPRprRsaMCGa> — mesmo conteúdo,
> com o estado de cada achado. Link privado; descreve defeitos ainda abertos.

## Estado em 14/11/2026, fim do dia

O levantamento abaixo está como foi escrito. O que mudou depois, no mesmo dia:

| achado | estado | onde |
|---|---|---|
| A1 contraste do botão primário | **corrigido** — 3,89:1 → 5,21:1, medido em produção | `eedc80a` |
| A2 92 rótulos de formulário | **corrigido** — 93 → 7 ocorrências, as 7 justificadas | `e6657fa` |
| A3 pular para o conteúdo, teclado no menu | **corrigido** | `eedc80a` |
| S1 cadeia de upload → otimizador | **corrigido** — `/_next/image` responde 404 em produção | `eedc80a` |
| S4 dependências mortas | **corrigido** — 5 pacotes, 38 no total | `eedc80a` |
| S5 `proxy-addr` | **corrigido** | `eedc80a` |
| S6 `allowedOrigins` morta | **corrigido** | `eedc80a` |
| S7 contagem | 5 críticas/15 altas → **3/8** | — |
| A2 (catraca) | `jsx-a11y` no CI, falha só no que for novo | `2afac17`, `93e13dd` |

**Achados novos, surgidos durante as correções:**

- **Tema decidido em dois lugares que discordavam.** As variáveis de cor seguiam a classe
  (escolha da pessoa) e os 465 utilitários `dark:` seguiam o sistema operacional. Corrigido
  em `b55fdb8`.
- **O expurgo de fotos nunca rodou.** O `\n` de um `curl -w` virou quebra de linha de
  verdade e invalidou o YAML inteiro; o GitHub não interpretava o arquivo. Corrigido em
  `d062ce9`, e o ensaio com `simular=true` reportou **0 fotos** além do prazo — o período
  sem expurgo não causou dano.
- **Não havia CI nenhum.** Os 1.213 testes, o `tsc` e o `next build` não rodavam
  automaticamente. `ci.yml` em `93e13dd`, verde nos dois jobs.
- **O `is_active` foi provado em produção.** `provar-conta-desativada.mjs`, 8 de 8
  conferências: desativar nega, suspender workspace nega na hora, e os dois voltam.

- **A casca do front não verificava o token (S2).** `getSession()` lê o cookie e não
  confere assinatura, e o papel ainda tinha `user_metadata` como alternativa — que o dono
  do token escreve. Provado explorável com cookie editado (HTTP 200 em `/admin`) e
  corrigido em `5b45b3d`.
- **A ficha do paciente mostrava metade do prontuário (U1).** Consultas, planos,
  recordatórios e exames entraram como abas, na ordem do atendimento, em `9d711a3`.
- **`script-src 'unsafe-inline'` saiu da CSP (S3).** Nonce por requisição mais
  `'strict-dynamic'`, em `middleware.ts`, com o nonce descendo até o script do
  `next-themes`. Preço: as 38 rotas que eram estáticas viraram dinâmicas, porque nonce é
  por requisição e HTML de build não tem nonce.

**Segue aberto:** U2 (um único gráfico no sistema inteiro), C1, C2, C3, a seção 5
(inteligência de gestão) e o achado novo da **prescrição que não é guardada em lugar
nenhum** — documento clínico assinado com CRN que não deixa rastro no prontuário.
**C2 bloqueia C1** — a decisão de guarda vem antes do código de exclusão.

## Método, e o que ele não alcança

Vale dizer antes dos achados, porque muda o peso de cada um.

**Medido de verdade:**
- Contraste e nomes acessíveis no navegador, na página de login rodando em `localhost:3009`, lendo o CSS computado — não olhando a captura de tela.
- `eslint-plugin-jsx-a11y@6.10.2` (regras `recommended`) sobre os 94 arquivos `.tsx` de `apps/web`, com o mapa de componentes do projeto (`Button`→`button`, `Input`→`input`, etc.), senão o plugin não enxerga nada dentro dos wrappers.
- `pnpm audit` sobre a árvore completa, separando dependência de runtime de dependência de desenvolvimento.
- Contraste dos tokens dos **dois** temas, calculado pela fórmula WCAG.

**Inspecionado no código, não exercitado:** tudo que exige sessão. As 31 páginas de `(dashboard)` ficam atrás do middleware, e eu não tenho como autenticar sem escrever no Auth de produção. Onde eu digo "a página X tem N campos sem rótulo", isso vem do analisador estático sobre o JSX, com amostras conferidas à mão.

**Não testado:** exploração real da cadeia de upload descrita em S1. Eu parei na análise do caminho; não tentei executar nada contra produção.

---

## 1. Acessibilidade

### A1 — O botão primário do produto reprova no WCAG AA · **alto**

Medido no navegador, na página de login:

| elemento | cor | fundo | razão | mínimo |
|---|---|---|---|---|
| Botão **Entrar** | `#FFFFFF` | `#1C9272` | **3,89:1** | 4,5:1 |
| Link "Esqueci minha senha" | `#1C9272` | `#FFFFFF` | **3,89:1** | 4,5:1 |
| Link "Criar conta" | `#1C9272` | `#FFFFFF` | **3,89:1** | 4,5:1 |

O token é `--primary: 164 68% 34%` em `app/globals.css:16`, e `components/ui/button.tsx:10` define a variante `default` como `bg-primary text-primary-foreground`. Ou seja: **toda ação primária do app autenticado reprova**. São 59 usos de `bg-primary`/`text-primary` em 26 arquivos.

O que torna isto notável é que **o projeto já sabe disso e já resolveu — no lugar errado.** O comentário em `tailwind.config.ts:33` diz, textualmente, que o tom puro "rende só 3.89:1 com texto branco (reprova no AA)" e por isso o degrau `brand-600` fecha em 28% de luminosidade. Mas a rampa `brand` foi criada para as páginas **públicas**, e o mesmo comentário termina instruindo: "Dentro do app autenticado, continue usando `bg-primary`". A correção foi aplicada à vitrine e não ao produto.

O tema **escuro** passa (6,49:1) — é só o claro.

**Correção:** uma linha. `--primary: 164 68% 34%` → `164 72% 28%`, que é o valor que o próprio repositório já calculou, e dá 5,21:1. O mínimo que passaria seria 30% (4,64:1); usar 28% alinha o app à rampa pública e acaba com os dois tons de verde. Não mexer no bloco `.dark`.

### A2 — 92 campos de formulário sem rótulo associado · **alto**

`jsx-a11y/label-has-associated-control`, em 12 páginas reais (o 93º achado é a definição do componente base, falso positivo):

```
21  patients/new              16  prescriptions/new        10  patients/[id]
 9  supplementation            8  settings                  7  interactions/new
 6  assessments/physical/new   5  assessments/nutritional/new
 5  supplementation/suggest    3  laboratory
 1  recordatorios/[id]         1  legal/dados
```

Conferido à mão, o padrão é este:

```tsx
<Label>Queixa principal</Label>                       // sem htmlFor
<Textarea {...register('mainComplaint')} />           // sem id
```

Quinze linhas abaixo, no mesmo arquivo, está a forma correta — `<Label htmlFor="dietaryRestrictions">` com `<Input id="dietaryRestrictions">`. O padrão existe e é aplicado de forma inconsistente, não por desconhecimento.

Para quem usa leitor de tela, o campo é anunciado sem nome. Para quem usa o mouse, clicar no rótulo não foca o campo. O pior caso é `patients/new`, com 21 campos — justamente o formulário que coleta dado pessoal sensível sob LGPD.

### A3 — Demais achados · **médio/baixo**

- `app/(dashboard)/layout.tsx:130` — o fundo escuro do menu móvel tem `onClick` sem equivalente de teclado (`click-events-have-key-events` + `no-static-element-interactions`). Quem navega por teclado não fecha o menu.
- `meal-plans/page.tsx:107` — `autoFocus`, que rouba o foco de quem está se orientando na página.
- 7 usos de `<img>` em vez de `next/image` — ver S1, porque isso tem consequência de segurança também.
- **Não há *skip link*.** Com 24 itens de menu, quem usa teclado atravessa o menu inteiro em cada página para chegar ao conteúdo.

O que está **certo** e não é comum: `lang="pt-BR"` presente, `<h1>` único e coerente, `autocomplete="email"` e `autocomplete="current-password"` corretos no login, e nenhum controle sem nome acessível na página pública.

---

## 2. UX e navegabilidade

### U1 — O menu é organizado por módulo; o trabalho é organizado por paciente · **alto**

São 24 destinos em 6 grupos, e o grupo "Análises" sozinho tem 9. Mais revelador: **4 destinos do menu são formulários de criação** (`/assessments/nutritional/new`, `/assessments/physical/new`, `/interactions/new`, `/prescriptions/new`, `/reports/new`). Clicar em "Avaliações → Nutricional" abre um formulário vazio que então pergunta de qual paciente se trata.

A consulta real não funciona assim. Ela é: abre o paciente → anamnese → avaliação → plano → prescrição → acompanhamento. O app obriga a sair para um módulo e reencontrar o paciente a cada etapa.

A ficha do paciente **já é** o lugar certo e está a meio caminho: tem abas (visão geral, avaliações, suplementos, interações, metas) e já passa `?patient=` ao criar avaliação. Mas faltam nas abas, hoje: **planos alimentares, consultas/agenda, exames, diário alimentar, recordatório 24 h e prescrições**. A ficha cobre 5 de 11 domínios clínicos; os outros 6 só existem como módulo solto.

### U2 — Um gráfico no sistema inteiro · **médio**

`EvolucaoAntropometrica.tsx` é o único arquivo que importa `recharts`. Tudo mais é tabela e contador. Num produto cujo valor é acompanhar evolução ao longo do tempo, e que já guarda a série histórica, é pouco.

### U3 — O que está bom

`CommandPalette`, `ShortcutsPanel`, `EmptyState`, `OnboardingBanner`, tema claro/escuro, menu lateral responsivo com overlay. A base de navegação é melhor que a média do segmento — o problema é a arquitetura de informação, não o acabamento.

---

## 3. Cibersegurança

A postura geral é, honestamente, boa para um projeto de uma pessoa: CSP montada à mão, HSTS, `trust proxy` com justificativa correta, lista de rotas públicas invertida para falhar seguro, limite de requisição por rota pública, segredo de CPF obrigatório no boot, verificação de JWT só por JWKS. Os achados abaixo são o que sobra.

### S1 — Cadeia de upload → otimizador de imagem → `librsvg` vulnerável · **alto**

Três fatos que isolados parecem pequenos e juntos formam um caminho:

1. **O tipo do arquivo vem do cliente.** `progress-photos.service.ts:47` e `food-diary.service.ts:279` validam `dto.mimeFoto`, um campo do corpo da requisição. Nenhum dos dois lê os bytes. Declarar `image/png` e enviar um SVG passa.
2. **O diário alimentar é público.** A rota é `@Public()`, e a credencial é o token do link — quem tem o link do paciente envia arquivo.
3. **`next@15.5.25` está na faixa da CVE-2026-96889** (corrigida em 15.5.28 / 16.4.1), e `sharp@0.35.4` carrega o `librsvg` vulnerável. `next.config.js` libera `dgvrflipjxaclpmudtwt.supabase.co` em `remotePatterns`, que é exatamente o host onde o arquivo do passo 1 aterrissa.

A análise pública da CVE indica que `sharp(buffer).metadata()` analisa o arquivo **antes** da checagem de `dangerouslyAllowSVG` — então não ter essa opção ligada reduz a exposição, mas não é fronteira de análise. Se o resultado é travar o processo ou executar código depende da build de `librsvg` da plataforma. **Eu não tentei explorar**; a afirmação é sobre o caminho existir, não sobre o resultado.

**O detalhe que resolve de graça:** o app **não usa `next/image` em lugar nenhum** — todas as 7 imagens são `<img>` (foi o que disparou o `no-img-element`). O endpoint `/_next/image` está publicamente roteável e carregando essa superfície **sem que o produto o use**.

Correção, em ordem de valor:
1. `images: { unoptimized: true }` e remover `remotePatterns` — elimina a superfície inteira, sem perder nada, porque nada a usa.
2. Subir `next` para ≥ 15.5.28.
3. Verificar os bytes no upload (*magic number*) em vez de confiar no `mimeFoto` do cliente — vale por si, independentemente da CVE.

### S2 — O portão de admin do frontend confia num cookie não verificado · **médio**

`middleware.ts:155` usa `supabase.auth.getSession()` e, logo abaixo, decide `role !== 'admin'` com o que veio dali. `getSession()` lê a sessão do cookie **sem validar a assinatura do JWT** — é o motivo de a própria Supabase recomendar `getUser()` no servidor. Um cookie forjado passa pelo middleware.

**O impacto é limitado e é justo dizer isso:** só a casca da página `/admin` renderiza. Todo dado vem da API, que valida por JWKS e, desde `73f4d47`, também confere `is_active`. Não é vazamento de dados — é um controle que não controla, da mesma família do `is_active` que corrigimos há duas semanas.

Trocar por `getUser()` exige subir `@supabase/ssr` de `^0.3.0` (que também é o motivo do comentário sobre a interface `get/set/remove` nas linhas 136-139).

### S3 — `script-src 'self' 'unsafe-inline'` em produção · **médio** · **CORRIGIDO**

`middleware.ts:82`. Com `unsafe-inline`, a CSP deixa de ser defesa contra XSS — vira quase só documentação. O Next 15 suporta CSP por *nonce* via middleware. É o degrau natural depois que o resto da CSP já está bem montado.

**Como ficou:** `script-src 'self' 'nonce-<16 bytes aleatórios>' 'strict-dynamic'`, sem `unsafe-inline` e sem `unsafe-eval`. O nonce vai no header da resposta (para o navegador) e no header da requisição (de onde o Next o extrai e o escreve em cada script que emite). `'strict-dynamic'` é necessário porque o webpack cria tags `<script>` em tempo de execução para carregar chunks.

**O que foi conferido no navegador, contra o build de produção:** 28 a 31 scripts por página, todos com nonce e **nenhum sem**; React hidratou (fibers anexados); nonce diferente em três requisições seguidas; roteamento pelo cliente de `/dashboard` para `/patients` sem recarga, com chunk injetado em execução e nenhum bloqueado; `/dashboard` sem sessão continua redirecionando para `/login?next=`. O caso espelhado: manipulador `onclick` injetado foi **bloqueado** (`script-src-attr`), com a violação registrada no console.

**O que NÃO foi conferido:** os gráficos (recharts), porque a API local não estava no ar e o dashboard não recebeu dados — o caminho é SVG por React, sem injeção de script, mas não foi visto funcionando sob a CSP nova.

**`style-src` MANTÉM `'unsafe-inline'`, de propósito.** `next/font` injeta `<style>` e os componentes usam atributo `style=`; nonce em estilo quebraria a tipografia do app. Estilo inline é alavanca muito menor que script.

**Preço, e não dá para contornar:** nonce é por requisição, e página pré-renderizada tem HTML fixo do build. Eram **38 das 45 rotas** estáticas, com 9 scripts inline sem nonce gravados no HTML — todas morreriam. Ler `headers()` no layout raiz torna as 45 dinâmicas. Custa pouco aqui porque as páginas são cascas de componente de cliente: os dados vêm da API pelo react-query, então o render do servidor não toca banco.

### S4 — Cinco dependências de runtime que ninguém importa · **médio**

Conferido por busca em `apps/api/src`:

| pacote | arquivos que importam |
|---|---|
| `jsonwebtoken` | 0 |
| `ioredis` | 0 |
| `@nestjs/jwt` | 0 |
| `@nestjs/passport` | 0 |
| `passport-jwt` | 0 |

`jsonwebtoken` é o que importa. O `jwt-auth.guard.spec.ts` tem uma catraca que falha se o código voltar a importá-lo — porque aceitar HS256 em paralelo ao JWKS era "uma segunda autoridade de assinatura". Mas o pacote continua **instalado na imagem de produção**, então reintroduzir o import compila sem tocar em `package.json`. Removendo a dependência, a catraca passa a ser física.

### S5 — `proxy-addr` com CVE de falsificação de IP · **médio**

Crítica no `pnpm audit`, via `express@4.22.1`. É relevante aqui especificamente porque o `main.ts:66-75` documenta que o IP sustenta duas coisas: o balde do limitador de requisição e a **prova de consentimento LGPD** (`lgpdConsentIp`). Uma prova que o cliente consegue influenciar prova menos do que parece.

### S6 — `allowedOrigins` de Server Actions aponta para três previews mortas · **baixo**

`next.config.js` lista `web-a1nk9hpuu-...`, `web-q114xajg3-...` e `web-oz5iownu3-...`, e **não** lista o domínio de produção. Não quebra nada hoje porque **não há nenhum `'use server'` no projeto** — é configuração morta. Mas é configuração morta que parece proteção, e no dia em que a primeira Server Action for escrita ela falhará em produção por um motivo difícil de achar.

### S7 — Contagem geral de vulnerabilidades

`5 críticas, 15 altas, 39 moderadas, 12 baixas`. Fora as já citadas, a maioria é de desenvolvimento (`handlebars` via `ts-jest`, `brace-expansion` via `jest`/`@nestjs/cli`, `extract-zip` e `basic-ftp` via `puppeteer`). Vale registrar que **`puppeteer` é dependência de runtime** e é usada em 1 arquivo — se a geração de PDF puder migrar para o `jspdf` que o frontend já usa, saem a dependência, as vulnerabilidades dela e centenas de MB da imagem.

---

## 4. Conformidade — CFN e LGPD

Esta seção tem o achado mais sério da auditoria.

### C1 — O pedido de exclusão da LGPD é registrado e nunca é lido · **alto**

```
patients.service.ts:307   dataDeletionRequestedAt: new Date()   ← única escrita
(nenhuma leitura em todo o projeto)
```

Grava-se a data e **nada acontece depois**. Não há rotina de apuração, não há fila, não há prazo, não há aviso. O titular exerce o direito do art. 18 da LGPD, o sistema responde que registrou, e o registro não vai a lugar nenhum.

É a **terceira ocorrência do mesmo padrão** em duas semanas, depois de `users.is_active` e `users.last_login_at`. Vale um varredura sistemática: toda coluna que promete um efeito precisa de alguém que a leia no caminho que produz o efeito.

### C2 — Não existe política de guarda do prontuário · **alto**

A Resolução CFN nº 594/2017 exige guarda do prontuário por **no mínimo 20 anos** a contar do último registro. O projeto implementa retenção só para **fotos do diário alimentar** (12 meses, com expurgo agendado e testado — bem feito). Para o prontuário em si, não há nada.

Isso cria uma tensão real com C1: quando a exclusão do paciente for implementada, ela **não pode** simplesmente apagar o prontuário — a LGPD (art. 16, I) preserva a retenção para cumprimento de obrigação legal, e a obrigação do CFN é de 20 anos. O desenho correto é anonimizar/bloquear o que é dado pessoal não essencial e manter o registro clínico pelo prazo legal, dizendo isso ao titular.

**Decidir isto antes de implementar C1**, não depois.

> Observação: o CFN abriu consulta pública para revisar a 594/2017, encerrada em 13/06/2026, e publicou um novo Código de Ética (Resolução 856/2026). Não confirmei no Diário Oficial se o prazo de 20 anos foi mantido. **Confirmar na fonte antes de codificar o número.**

### C3 — Sem TCLE específico de telenutrição · **médio**

O `SalaDeVideo` atende consulta online, e o checklist do CFN para telenutrição inclui TCLE aceito e registrado em prontuário. O que existe hoje é `lgpd_consent`, que é consentimento para **tratamento de dados** — outra coisa. São dois consentimentos distintos e o segundo não é coletado.

---

## 5. Inteligência de gestão

O que existe: `/admin/metrics` devolve contagem de workspaces, usuários, pacientes, tokens consumidos no mês e uso por módulo em 30 dias. O painel do profissional traz contagem de pacientes, alertas pendentes/críticos, saldo de token e atividade recente.

São **números de estoque e de consumo de plataforma**. Falta o que diz se a clínica vai bem:

| pergunta de gestão | dado já existe? | hoje responde? |
|---|---|---|
| Quantos pacientes abandonaram? | `appointments`, `patients.is_active` | não |
| Qual a taxa de falta? | `appointments.status` (já tem `cancelada`) | não |
| Quanto tempo entre cadastro e 1º plano? | `patients.created_at`, `meal_plans.created_at` | não |
| Qual a adesão ao plano? | `food_diary_entries` × `meal_plan_items` | não |
| Os pacientes estão evoluindo? | `physical_assessments` (série histórica) | só individual |
| Qual a receita e a inadimplência? | `charges` | parcialmente |
| Quais alertas clínicos mais aparecem? | `clinical_alerts` | não |

**O dado já está no banco em todos os casos.** Falta a consulta e a tela. É o item de melhor relação valor/esforço do plano inteiro, e é também o que diferencia de concorrente.

Nota de honestidade do código que vale preservar: o MRR foi **removido** do painel com o comentário de que calcular receita sobre preço que ninguém cobra seria "número inventado num painel de gestão — pior que número nenhum", e `mrrBrl` devolve `null` e não `0`. Essa disciplina é o que torna o painel confiável; os indicadores novos devem seguir a mesma regra.

---

## 6. Benchmarking

Preços conferidos em novembro/2026; promoções de entrada distorcem a comparação, então o valor que vale é o de renovação.

| | NutriPerformance | Dietbox | WebDiet | Avanutri |
|---|---|---|---|---|
| Preço | não cobra | R$ 91,90/mês (após 3 meses a R$ 49,90); Premium R$ 133,90 | ~R$ 49/mês (dado antigo) | R$ 123,50 (online) |
| App do paciente | portal por link, sem conta | app nativo | app nativo | app gratuito |
| Diário alimentar | sim, com foto | sim | sim | sim |
| Lista de compras | sim | sim | sim | sim |
| Agenda | sim | sim + Google Agenda (Premium) | sim | — |
| WhatsApp | não | lembretes automáticos | — | — |
| Financeiro | sim | recibos | — | — |
| Teleconsulta | sim | — | — | — |
| **IA clínica** | **assistente RAG, protocolo de suplementação, anamnese por áudio, importação de laudo** | — | — | — |
| **Interações fármaco-nutriente** | **sim** | — | — | — |
| **Biodisponibilidade** | **sim** | — | — | — |
| **Supervisão de estagiário** | **sim** | — | — | — |
| Base de alimentos | TACO oficial do NEPA + IBGE + USDA | TACO, IBGE, USDA | TACO, USDA | própria + TACO |

**Leitura.** O produto está acima do mercado exatamente onde o mercado não compete — análise clínica e IA — e abaixo em duas coisas banais que todo concorrente tem: **app nativo do paciente** e **WhatsApp**. No Brasil, o WhatsApp não é um canal entre outros; é *o* canal. Lembrete automático de consulta por WhatsApp reduz falta, e falta é a dor financeira nº 1 de consultório.

O rigor da base de alimentos é um diferencial que nenhum concorrente anuncia e que **ninguém vê**: carregar da planilha oficial do NEPA, separar mono de poli medidas, avisar quando a própria TACO se contradiz em 27 dos 597 alimentos. Isso é argumento comercial e hoje está escondido dentro de um componente.

---

## 7. Estratégia de evolução

**Posicionamento.** Não competir por preço com Dietbox. O produto já é outra categoria: *suporte à decisão clínica em nutrição*, com interação fármaco-nutriente, biodisponibilidade, exames e supervisão de estagiário. Esse conjunto atende dois públicos que pagam mais e são mal servidos: **nutrição clínica hospitalar/ambulatorial** e **instituições de ensino com estágio supervisionado** — e o módulo de supervisão já existe, o que é raro.

**Três apostas, em ordem de retorno:**

1. **Transformar o rigor da base em produto visível.** Uma procedência por nutriente na tela ("TACO 4ª ed., medido" / "IBGE, deduzido" / "a fonte não publica"). Já existe no modelo de dados — é apresentação. Para quem responde por documento clínico assinado, isso é diferencial defensável.

2. **Painel de evolução da carteira.** A seção 5. Transforma o produto de "onde eu registro" em "onde eu entendo meu consultório".

3. **WhatsApp para lembrete e diário.** Confirmação de consulta e lembrete de refeição. É o canal onde o paciente já está, e ataca a falta — que é dinheiro.

**Deliberadamente fora:** app nativo. Custa caro, e o portal por link (sem conta, sem senha, sem recuperação) é uma decisão de arquitetura boa, já documentada no `patient-portal-link.entity.ts`. Um PWA bem-feito cobre 80% do valor. Notar que o PWA foi desligado por conflito de peer com Next 15 e `next-pwa` sem manutenção — `@serwist/next` é o caminho.

---

## 8. Plano de melhorias

Ordenado por (dano se não fizer) ÷ (esforço).

### Agora — dias, risco baixo, efeito alto

| # | item | esforço | por quê |
|---|---|---|---|
| 1 | `--primary` → `164 72% 28%` (A1) | 1 linha | corrige 59 usos e o botão padrão de uma vez |
| 2 | `images: { unoptimized: true }` + remover `remotePatterns` (S1) | 2 linhas | elimina superfície que o produto não usa |
| 3 | Subir `next` para ≥ 15.5.28 (S1) | 1 linha + build | CVE-2026-96889 |
| 4 | Remover as 5 dependências mortas (S4) | 1 commit | torna física a catraca do `jsonwebtoken` |
| 5 | Limpar `allowedOrigins` (S6) | 1 linha | configuração morta que parece proteção |
| 6 | *Skip link* + teclado no overlay do menu (A3) | 1 h | barreira de teclado em toda página |

### Próximas semanas

| # | item | esforço | por quê |
|---|---|---|---|
| 7 | Verificar bytes no upload, não o MIME do cliente (S1) | ~meio dia | fecha o passo 1 da cadeia, vale sozinho |
| 8 | **Decidir** guarda × exclusão (C2) antes de codificar | reunião + nota de decisão | C1 depende desta decisão |
| 9 | Implementar o fluxo de exclusão LGPD (C1) | ~3 dias | hoje o direito do titular não produz efeito |
| 10 | Rotular os 92 campos (A2) | ~1,5 dia | começar por `patients/new` (21) e `prescriptions/new` (16) |
| 11 | TCLE de telenutrição (C3) | ~1 dia | exigência do CFN para consulta online |
| 12 | `getUser()` no middleware + subir `@supabase/ssr` (S2) | ~meio dia | controle que não controla |
| 13 | Ficha do paciente como centro: planos, agenda, exames, diário, recordatório, prescrições nas abas (U1) | ~1 semana | o maior ganho de UX do app |

### Trimestre

| # | item | por quê |
|---|---|---|
| 14 | Painel de evolução da carteira (seção 5) | maior valor/esforço do plano; o dado já existe |
| 15 | CSP por nonce (S3) | CSP volta a ser defesa |
| 16 | Procedência por nutriente na tela | o diferencial invisível vira visível |
| 17 | WhatsApp: lembrete e confirmação | ataca a falta, que é dinheiro |
| 18 | Trocar `puppeteer` por `jspdf` no servidor | tira dependência, CVEs e centenas de MB |
| 19 | PWA por `@serwist/next` | 80% do app nativo sem o custo dele |
| 20 | Catraca de a11y no CI (`jsx-a11y`, falha só em achado novo) | impede os 92 de voltarem |

### Pendências anteriores que continuam abertas

- Rotação da senha do banco.
- Quatro profissionais sem registro de conselho — o CRN é o que identifica quem assina documento clínico.
- Duas contas para a mesma Daniela (`daniela-santanasouza@hotmail.com` e `daniela.santanasouza88@gmail.com`), em dois workspaces, ambas ativas.
- Provar em produção que desativar nega acesso (`scripts/provar-conta-desativada.mjs`) — escrito, nunca executado.

---

## Fontes

- [Dietbox — site oficial](https://dietbox.me/pt-BR) · [Capterra](https://www.capterra.com/p/216141/Dietbox/) · [GetApp](https://www.getapp.com/healthcare-pharmaceuticals-software/a/dietbox-1/)
- [Avanutri Online — loja oficial](https://www.loja.avanutri.com.br/prod,idproduto,5077878,linha-nutricao-software-software-avanutri-online)
- [App do paciente Dietbox — MobileTime](https://www.mobiletime.com.br/?p=647323) · [WebDiet para pacientes](https://spark.mwm.ai/en/apps/webdiet-para-pacientes/1195115431)
- [Resolução CFN nº 856/2026 — SisNormas](https://sisnormas.cfn.org.br/viewPage.html?id=856) · [Consulta pública de revisão da 594/2017](https://consulta-publica.cfn.org.br/index.php?page=consulta&id=8) · [Prontuário e a 594/2017](https://www.dietsystem.com.br/blog/prontuario-nutricional-cfn-594/) · [Exigências do CFN para teleconsulta](https://linksingular.com/nutrition/pt/blog/teleconsulta-nutricionista-regras-cfn)
- [GHSA-2464-fhr4-w9xw / CVE-2026-96889](https://advisories.gitlab.com/npm/next/GHSA-2464-fhr4-w9xw/) · [The Hacker News](https://thehackernews.com/2026/10/nextjs-ships-out-of-band-patch-for-two.html) · [Análise do caminho de exploração](https://blog.ostorlab.co/ghsa-2464-fhr4-w9xw-nextjs-image-optimization-rce.html)
