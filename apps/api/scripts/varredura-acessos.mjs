/**
 * Varredura de ACESSOS: quem consegue ler e EDITAR o que, e de quem.
 *
 * Duas perguntas distintas, e a segunda e a que machuca:
 *
 *  1. PAPEL — um educador fisico consegue editar avaliacao nutricional?
 *  2. ISOLAMENTO — uma nutricionista do workspace A consegue abrir ou EDITAR
 *     o prontuario de um paciente do workspace B?
 *
 * A primeira e questao de produto. A segunda e vazamento de prontuario entre
 * clinicas — e nao aparece em teste unitario, porque todo teste roda com um
 * `req.user` fabricado no proprio teste. So exercitando producao com token
 * real de cada conta.
 *
 * NAO imprime nome nem dado de paciente. Quando uma leitura indevida passa,
 * reporta que passou e QUAIS campos vieram, nunca o conteudo.
 *
 *   node scripts/varredura-acessos.mjs
 */
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';

function carregarEnv(c) {
  try {
    for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
carregarEnv(new URL('../.env', import.meta.url));
carregarEnv(new URL('../../web/.env.local', import.meta.url));
process.env.SUPABASE_ANON_KEY ||= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const API = 'https://nutriperformance-clinical.onrender.com';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } });
const servico = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
};

async function token(email) {
  const { data: ml, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !ml?.properties?.hashed_token) return null;
  const { data: s } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: ml.properties.hashed_token });
  return s?.session?.access_token ?? null;
}

// ── quem testar: um por papel, em workspaces DIFERENTES ─────────────────────
//
// CONTAS DE TESTE, NAO DE PESSOAS REAIS.
//
// Esta varredura CRIA paciente de sonda no workspace de cada ator. Enquanto
// apontava para contas reais, cada execucao escrevia no prontuario de
// profissionais em exercicio e dependia de a limpeza funcionar — e a limpeza
// tinha um passo quebrado, descoberto em 22/10/2026.
//
// As tres contas abaixo sao criadas por `scripts/conta-de-varredura.mjs`,
// nos dois workspaces de demonstracao. Rode-o antes, se elas nao existirem.
//
// O workspace do educador fisico e OUTRO de proposito: o que esta varredura
// prova e que um ator nao enxerga o prontuario de outra clinica. Com todos
// no mesmo workspace ela passaria sem testar isolamento nenhum.
const CONTAS = [
  { email: 'varredura-admin@nutritest.com', papel: 'admin' },
  { email: 'varredura@nutritest.com', papel: 'nutritionist' },
  { email: 'varredura-fit@nutritest.com', papel: 'fitness_professional' },
];

const atores = [];
for (const c of CONTAS) {
  const t = await token(c.email);
  if (!t) { console.log(`AVISO ${c.email}: nao consegui autenticar — pulado`); continue; }
  const payload = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'));
  atores.push({ ...c, token: t, ws: payload.app_metadata?.workspace_id ?? '?' });
}
if (atores.length < 2) {
  console.log('Preciso de ao menos duas contas para testar isolamento.');
  process.exit(1);
}

console.log('atores:');
for (const a of atores) console.log(`  ${a.papel.padEnd(22)} ${a.email.padEnd(34)} ws ${String(a.ws).slice(0, 8)}`);

// ── um paciente por workspace, pela chave de servico ────────────────────────
const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/patients?select=id,workspace_id&limit=200`, { headers: servico });
const pacientes = await r.json();
const porWs = new Map();
for (const p of pacientes) if (!porWs.has(p.workspace_id)) porWs.set(p.workspace_id, p.id);

async function chamar(ator, metodo, caminho, corpo) {
  const resp = await fetch(API + caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${ator.token}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  let json = null;
  try { json = JSON.parse(await resp.text()); } catch {}
  return { status: resp.status, ok: resp.ok, json };
}

const achados = [];

/**
 * "Passou" para uma LISTA significa ter devolvido REGISTRO, nao HTTP 200.
 *
 * As rotas de listagem por paciente filtram por workspace e devolvem `[]`
 * quando o paciente e de outra clinica — 200 com lista vazia esta CERTO, e
 * arguivelmente melhor que 404, que confirmaria a existencia do paciente.
 *
 * A primeira versao desta varredura olhava so o status e acusou quatro
 * "vazamentos" que nao existiam. Guarda que grita falso e ignorada, e ai nao
 * serve para o dia em que o vazamento for real.
 */
function temDado(r) {
  if (!r.ok) return false;
  if (Array.isArray(r.json)) return r.json.length > 0;
  if (r.json && typeof r.json === 'object') {
    const chaves = Object.keys(r.json);
    if (chaves.length === 0) return false;
    // `{ items: [] }` tambem e vazio.
    if (Array.isArray(r.json.items)) return r.json.items.length > 0;
    return true;
  }
  return false;
}

function avaliar(desc, r, { deveriaPassar, porConteudo = false }) {
  const passou = porConteudo ? temDado(r) : r.ok;
  const certo = passou === deveriaPassar;
  if (!certo) {
    achados.push({ desc, status: r.status, esperado: deveriaPassar ? 'permitir' : 'NEGAR' });
  }
  console.log(`${certo ? 'OK   ' : '>>>>>'} ${desc.padEnd(58)} HTTP ${r.status}`);
  return certo;
}

/**
 * Espera a API acordar ANTES de qualquer passo.
 *
 * O Render do plano gratuito hiberna por inatividade, e as primeiras
 * requisicoes depois disso voltam 502 enquanto o processo sobe. Na execucao de
 * 22/10/2026 os tres POST /patients do preparo cairam em 502, a varredura
 * seguiu com "bloco de papel sera parcial" e os passos seguintes — feitos
 * segundos depois, com a API ja de pe — passaram. Ou seja: o preparo degradou
 * por causa do ambiente e a varredura testou menos do que diz testar, sem
 * reprovar. E o mesmo falso verde que ja corrigimos na varredura de rotas.
 *
 * Aqui o despertar e explicito: se a API nao responder, a varredura PARA, em
 * vez de medir meia coisa.
 */
async function esperarApi(tentativas = 12, esperaMs = 10000) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const r = await fetch(`${API}/health`);
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        console.log(`API de pe na tentativa ${i} — commit ${j.commit ?? '?'}`);
        return j;
      }
      console.log(`  acordando a API... tentativa ${i}, HTTP ${r.status}`);
    } catch (e) {
      console.log(`  acordando a API... tentativa ${i}, ${e.message}`);
    }
    await new Promise((s) => setTimeout(s, esperaMs));
  }
  console.log('A API nao respondeu. Varredura ABORTADA — medir meia coisa e pior que nao medir.');
  process.exit(1);
}
const saude = await esperarApi();

// ── 1. paciente de sonda no proprio workspace de cada ator ──────────────────
//
// Os workspaces dos atores podem nao ter paciente nenhum, e ai o bloco de
// papel nao roda e a varredura "passa" sem ter testado nada. Criar um torna o
// teste independente do que ha em producao.
console.log('\n── preparo: paciente de sonda por ator ──');
const sondas = [];
for (const a of atores) {
  const r = await chamar(a, 'POST', '/patients', {
    name: '[SONDA] varredura de acessos',
    birthDate: '1990-01-01',
    gender: 'female',
    lgpdConsent: true,
    internalCode: `SONDA-${Date.now().toString().slice(-6)}-${a.papel.slice(0, 3)}`,
  });
  if (r.json?.id) {
    sondas.push({ ator: a, patientId: r.json.id });
    porWs.set(a.ws, r.json.id);
    console.log(`OK    ${a.papel}: paciente de sonda criado`);
  } else {
    console.log(`AVISO ${a.papel}: nao criou paciente (HTTP ${r.status}) — bloco de papel sera parcial`);
  }
}

console.log('\n── acesso ao proprio workspace ──');
for (const a of atores) {
  const meu = porWs.get(a.ws);
  if (!meu) continue;
  avaliar(`${a.papel}: ler paciente do proprio ws`,
    await chamar(a, 'GET', `/patients/${meu}`), { deveriaPassar: true });
}

// ── 2. ISOLAMENTO — paciente de OUTRO workspace ─────────────────────────────
console.log('\n── isolamento entre workspaces (tem que NEGAR) ──');
for (const a of atores) {
  for (const [ws, pid] of porWs) {
    if (ws === a.ws) continue;

    const leitura = await chamar(a, 'GET', `/patients/${pid}`);
    const ok = avaliar(`${a.papel}: LER paciente de ws ${String(ws).slice(0, 8)}`, leitura, { deveriaPassar: false });
    if (!ok && leitura.json) {
      // Reporta QUAIS campos vazaram, nunca o conteudo.
      console.log(`      vazou: ${Object.keys(leitura.json).join(', ')}`);
    }

    avaliar(`${a.papel}: EDITAR paciente de ws ${String(ws).slice(0, 8)}`,
      await chamar(a, 'PATCH', `/patients/${pid}`, { clinicalConditions: ['sonda de acesso'] }),
      { deveriaPassar: false });

    // Estas sao listas: o que importa e vir REGISTRO, nao o codigo HTTP.
    for (const [rotulo, rota] of [
      ['avaliacoes nutricionais', `/assessments/nutritional/patient/${pid}`],
      ['avaliacoes fisicas', `/assessments/physical/patient/${pid}`],
      ['planos', `/meal-plans/patient/${pid}`],
      ['metas', `/goals/patient/${pid}`],
      ['suplementacao', `/supplementation/patient/${pid}`],
      ['exames', `/laboratory/patient/${pid}`],
    ]) {
      const resp = await chamar(a, 'GET', rota);
      const ok = avaliar(`${a.papel}: ${rotulo} de ws ${String(ws).slice(0, 8)}`,
        resp, { deveriaPassar: false, porConteudo: true });
      if (!ok) {
        const n = Array.isArray(resp.json) ? resp.json.length : '?';
        console.log(`      VAZOU ${n} registro(s) — campos: ${Object.keys(resp.json?.[0] ?? {}).join(', ')}`);
      }
    }

    break; // um workspace alheio por ator ja prova a regra
  }
}

// ── 3. papel: quem edita o que ──────────────────────────────────────────────
console.log('\n── papel (dentro do proprio workspace) ──');
//
// SO ESCREVE EM PACIENTE DE SONDA.
//
// `porWs` comeca povoado com pacientes que JA existem em producao, para o
// bloco de isolamento ter um alvo alheio. O bloco de papel, porem, CRIA
// avaliacao e plano — e a limpeza so reconhece paciente com internal_code
// "SONDA-". Quando o preparo falhava (502 na hibernacao do Render, em
// 22/10/2026), este bloco caia no paciente preexistente e deixava cinco
// registros no prontuario dele, invisiveis para a limpeza.
//
// Escrever no prontuario de alguem para testar permissao e inaceitavel mesmo
// no workspace de demonstracao. Sem sonda, o bloco nao roda e diz que nao
// rodou.
const sondaPorWs = new Map(sondas.map((s) => [s.ator.ws, s.patientId]));
for (const a of atores) {
  const meu = sondaPorWs.get(a.ws);
  if (!meu) {
    console.log(`PULOU ${a.papel}: sem paciente de sonda — nao escrevo em prontuario preexistente`);
    achados.push({
      desc: `${a.papel}: bloco de papel nao rodou (sem paciente de sonda)`,
      status: 0, esperado: 'rodar',
    });
    continue;
  }

  // Avaliacao nutricional e NutritionistOnly: educador fisico NAO entra.
  avaliar(`${a.papel}: criar avaliacao NUTRICIONAL`,
    await chamar(a, 'POST', '/assessments/nutritional', { patientId: meu, professionalNotes: '[SONDA]' }),
    { deveriaPassar: a.papel !== 'fitness_professional' });

  // Avaliacao fisica e FitnessProfessionalOnly: nutricionista NAO entra.
  avaliar(`${a.papel}: criar avaliacao FISICA`,
    await chamar(a, 'POST', '/assessments/physical', { patientId: meu, weightKg: 70, heightCm: 170 }),
    { deveriaPassar: a.papel !== 'nutritionist' });

  // Plano alimentar e NutritionistOnly, NAO ClinicalStaff: prescrever dieta e
  // ato privativo do nutricionista (CFN). O educador fisico tem que levar 403.
  //
  // Esta linha ja esteve errada: eu esperava que os tres passassem, a
  // varredura acusou o educador fisico e o "defeito" era a minha expectativa.
  // Deixo registrado porque a regra e de competencia profissional, nao de
  // preferencia de produto — afrouxar aqui seria deixar alguem prescrever o
  // que nao pode assinar.
  avaliar(`${a.papel}: criar plano alimentar (privativo do nutricionista)`,
    await chamar(a, 'POST', '/meal-plans', { patientId: meu, nome: '[SONDA]' }),
    { deveriaPassar: a.papel !== 'fitness_professional' });

  // Administracao da plataforma: so admin.
  avaliar(`${a.papel}: listar workspaces (admin da plataforma)`,
    await chamar(a, 'GET', '/admin/workspaces'),
    { deveriaPassar: a.papel === 'admin' });
}

// ── limpeza ────────────────────────────────────────────────────────────────
//
// A varredura cria paciente de sonda e, no bloco de papel, avaliacoes e planos
// para ele. Tudo some junto: limpar-teste-escrita.mjs apaga filhos antes do pai
// e so toca em internal_code "SONDA-" ou "TESTE-".
console.log('\n── limpeza ──');
if (sondas.length) {
  console.log(`${sondas.length} paciente(s) de sonda criado(s), com os registros do bloco de papel.`);
  console.log('Rode: node scripts/limpar-teste-escrita.mjs --apagar');
} else {
  console.log('nenhuma sonda criada');
}

console.log(`\n${'='.repeat(62)}`);
if (achados.length) {
  console.log(`=== ${achados.length} COMPORTAMENTO(S) FORA DO ESPERADO ===`);
  for (const a of achados) console.log(`  ${a.desc} -> HTTP ${a.status} (esperado: ${a.esperado})`);
  process.exitCode = 1;
} else {
  console.log('papel e isolamento se comportam como esperado');
}
