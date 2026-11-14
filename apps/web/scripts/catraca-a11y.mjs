#!/usr/bin/env node
/**
 * Catraca de acessibilidade.
 *
 * ============================== POR QUE EXISTE ==============================
 *
 * Em 14/11/2026 o projeto tinha 92 campos de formulário cujo `<Label>` não
 * estava associado a controle nenhum. Leitor de tela anunciava o campo sem
 * nome; clicar no rótulo não focava o campo. O pior caso era `patients/new`,
 * com 21 campos — o formulário que coleta dado pessoal sensível sob LGPD.
 *
 * Não era desconhecimento: o padrão certo aparecia quinze linhas abaixo do
 * errado, no mesmo arquivo. Era inconsistência acumulada, e o padrão errado é
 * mais curto de escrever — então volta sozinho.
 *
 * ========================== CATRACA, NÃO PROIBIÇÃO ==========================
 *
 * Proibir todas as ocorrências quebraria o CI hoje, porque sobraram 7
 * legítimas. Em vez disso, `a11y-permitidos.json` lista o que já existe e por
 * quê, e esta catraca falha **só no que for novo**.
 *
 * A lista também não pode envelhecer: se um arquivo passar a ter MENOS
 * ocorrências que o permitido, a catraca falha pedindo para apertar o número.
 * Permissão que sobra é permissão que deixa de proteger.
 *
 * ================================ O QUE FALHA ===============================
 *
 *   - achado novo em arquivo que não está na lista;
 *   - achado a mais num arquivo que está na lista;
 *   - achado a menos num arquivo da lista (aperte o número);
 *   - arquivo na lista que não existe mais.
 *
 * =============================== O QUE ELA NÃO PEGA =========================
 *
 * A contagem é por (arquivo, regra). Trocar uma ocorrência legítima por uma
 * nova e errada DENTRO do mesmo arquivo mantém o total e passa. A alternativa
 * — fixar linha e coluna — quebraria a cada refatoração e seria desligada na
 * primeira semana. Preferi a catraca que sobrevive ao dia a dia.
 *
 *   node scripts/catraca-a11y.mjs              -> confere
 *   node scripts/catraca-a11y.mjs --atualizar  -> regrava a lista
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const LISTA = join(RAIZ, 'a11y-permitidos.json');
const ATUALIZAR = process.argv.includes('--atualizar');

const SEP = String.fromCharCode(92);

function curto(p) {
  const i = p.indexOf('apps' + SEP + 'web' + SEP);
  const j = p.indexOf('apps/web/');
  const corte = i >= 0 ? p.slice(i + 9) : j >= 0 ? p.slice(j + 9) : p;
  return corte.split(SEP).join('/');
}

// ── roda o eslint ───────────────────────────────────────────────────────────
const bin = join(RAIZ, 'node_modules', 'eslint', 'bin', 'eslint.js');
if (!existsSync(bin)) {
  console.error('eslint nao encontrado em apps/web. Rode `pnpm install`.');
  process.exit(2);
}

let bruto;
try {
  bruto = execFileSync(
    process.execPath,
    [bin, '--no-config-lookup', '-c', join(RAIZ, 'eslint.a11y.config.mjs'),
      'app/**/*.tsx', 'components/**/*.tsx', '-f', 'json'],
    { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
} catch (e) {
  // O eslint sai com codigo 1 quando ha achados — que e o caso normal aqui.
  bruto = e.stdout;
  if (!bruto) {
    console.error('eslint falhou sem produzir saida:');
    console.error(e.stderr || e.message);
    process.exit(2);
  }
}

const resultado = JSON.parse(bruto);

// So regras de acessibilidade. As outras aparecem como "Definition for rule
// ... was not found", vindas de comentarios `eslint-disable` de plugins que
// esta config nao carrega — ruido, nao achado.
const atual = {};
const detalhe = {};
for (const f of resultado) {
  for (const m of f.messages) {
    if (!m.ruleId || !m.ruleId.startsWith('jsx-a11y/')) continue;
    const arq = curto(f.filePath);
    const chave = arq + ' :: ' + m.ruleId;
    atual[chave] = (atual[chave] || 0) + 1;
    (detalhe[chave] ??= []).push('linha ' + m.line + ': ' + m.message);
  }
}

if (ATUALIZAR) {
  const permitido = {};
  for (const k of Object.keys(atual).sort()) permitido[k] = atual[k];
  writeFileSync(
    LISTA,
    JSON.stringify(
      {
        _leia: 'Ocorrencias de acessibilidade ja existentes e conferidas uma a uma. '
          + 'A catraca falha so no que for NOVO. Ao acrescentar uma linha aqui, '
          + 'escreva o porque em _motivos — entrada sem motivo e divida, nao permissao.',
        _motivos: lerMotivos(),
        permitido,
      },
      null,
      2,
    ) + String.fromCharCode(10),
    'utf8',
  );
  console.log('lista regravada com ' + Object.keys(permitido).length + ' entrada(s).');
  process.exit(0);
}

function lerMotivos() {
  if (!existsSync(LISTA)) return {};
  try { return JSON.parse(readFileSync(LISTA, 'utf8'))._motivos ?? {}; } catch { return {}; }
}

if (!existsSync(LISTA)) {
  console.error('a11y-permitidos.json nao existe. Gere com --atualizar e confira a lista a mao.');
  process.exit(2);
}

const permitido = JSON.parse(readFileSync(LISTA, 'utf8')).permitido ?? {};

const novos = [];
const sobrando = [];

for (const [chave, n] of Object.entries(atual)) {
  const limite = permitido[chave] ?? 0;
  if (n > limite) novos.push({ chave, n, limite, exemplos: detalhe[chave].slice(0, 3) });
}
for (const [chave, limite] of Object.entries(permitido)) {
  const n = atual[chave] ?? 0;
  if (n < limite) sobrando.push({ chave, n, limite });
}

const totalAtual = Object.values(atual).reduce((s, n) => s + n, 0);
const totalLimite = Object.values(permitido).reduce((s, n) => s + n, 0);
console.log('acessibilidade: ' + totalAtual + ' ocorrencia(s), ' + totalLimite + ' permitida(s).');

if (novos.length) {
  console.log('');
  console.log('ACHADO NOVO — a catraca nao deixa passar:');
  for (const x of novos) {
    console.log('  ' + x.chave + '  (' + x.n + ', permitido ' + x.limite + ')');
    for (const e of x.exemplos) console.log('      ' + e);
  }
  console.log('');
  console.log('Corrija o achado. Se ele for legitimo, acrescente a linha em');
  console.log('a11y-permitidos.json COM o motivo em _motivos — nao rode --atualizar no automatico.');
}

if (sobrando.length) {
  console.log('');
  console.log('PERMISSAO SOBRANDO — aperte o numero (ou o arquivo sumiu):');
  for (const x of sobrando) console.log('  ' + x.chave + '  (agora ' + x.n + ', permitido ' + x.limite + ')');
  console.log('');
  console.log('Rode: node scripts/catraca-a11y.mjs --atualizar');
}

if (novos.length || sobrando.length) process.exit(1);
console.log('nada novo.');
