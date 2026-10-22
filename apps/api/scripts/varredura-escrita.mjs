/**
 * Exercita a GRAVACAO e a EDICAO dos registros clinicos contra PRODUCAO.
 *
 * POR QUE EXISTE
 *
 * `varredura-rotas.mjs` cobre 64 rotas GET. Escrita nunca foi varrida — e foi
 * exatamente a gravacao que apresentou dificuldades numa consulta real com a
 * nutricionista (21/10/2026). Ler nao prova escrever: um POST pode falhar por
 * DTO, por coluna NOT NULL, por guard de papel ou por constraint, e nada disso
 * aparece numa varredura de leitura.
 *
 * O QUE ELE FAZ
 *
 * Cria um paciente marcado com [TESTE], grava um registro de cada tipo para
 * ele, EDITA cada um (a edicao foi pedida explicitamente) e no fim apaga tudo.
 * Cada passo reporta o HTTP e o motivo quando falha.
 *
 * LIMPEZA
 *
 * O paciente de teste e sempre removido no fim, inclusive quando um passo do
 * meio falha. Se a limpeza nao conseguir, o script DIZ o que ficou para tras —
 * dado de teste esquecido em producao e pior que varredura nenhuma.
 *
 *   node scripts/varredura-escrita.mjs <email>
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
const email = process.argv[2];
if (!email) {
  console.error('uso: node scripts/varredura-escrita.mjs <email>');
  process.exit(1);
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data: ml } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } });
const { data: sessao } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: ml.properties.hashed_token });
const H = {
  Authorization: `Bearer ${sessao.session.access_token}`,
  'Content-Type': 'application/json',
};

const MARCA = '[TESTE] varredura de escrita';
const hoje = new Date().toISOString().slice(0, 10);

const passos = [];
const criados = { patientId: null, outros: [] };

async function chamar(metodo, caminho, corpo) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: H,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch {}
  return { status: r.status, ok: r.ok, json, texto };
}

/**
 * Passos em que o 403 e a RESPOSTA CERTA.
 *
 * A separacao entre nutricionista e educador fisico e deliberada: prescrever
 * dieta e privativo do nutricionista (CFN), avaliar composicao corporal por
 * dobras e do educador fisico (CONFEF). Esta varredura roda como
 * nutricionista, entao o 403 na avaliacao fisica e o veto funcionando.
 *
 * Tratar isso como falha faria a varredura reprovar o sistema por fazer o
 * certo -- e, pior, treinaria quem a le a ignorar o relatorio. Mas o 403
 * tambem nao pode virar silencio: se um dia ele VIRAR 201, a separacao caiu
 * e ninguem percebeu. Por isso o passo e registrado como veto esperado, e
 * falha se o veto deixar de acontecer.
 */
const VETO_ESPERADO = new Set(['criar avaliacao fisica']);

function registrar(nome, r, extra = '') {
  const vetoEsperado = VETO_ESPERADO.has(nome);
  const ok = vetoEsperado ? r.status === 403 : r.ok;
  passos.push({ nome, ok, status: r.status, vetoEsperado });

  if (vetoEsperado) {
    const rotulo = ok ? 'VETO ' : 'FALHA';
    const nota = ok
      ? ' (403 esperado: avaliacao fisica e do educador fisico)'
      : ` — o veto NAO aconteceu: HTTP ${r.status}. A separacao de conselho caiu.`;
    console.log(`${rotulo} ${nome.padEnd(42)} HTTP ${r.status}${nota}`);
    return ok;
  }

  const motivo = ok ? '' : ` — ${(r.json?.message ?? r.texto ?? '').toString().slice(0, 150)}`;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome.padEnd(42)} HTTP ${r.status}${extra}${motivo}`);
  return ok;
}

// ── 1. paciente ─────────────────────────────────────────────────────────────
console.log('── cadastro ──');
const pac = await chamar('POST', '/patients', {
  name: MARCA,
  birthDate: '1990-05-15',
  gender: 'female',
  lgpdConsent: true,
  internalCode: `TESTE-${Date.now().toString().slice(-6)}`,
});
registrar('criar paciente', pac);
criados.patientId = pac.json?.id ?? null;

if (!criados.patientId) {
  console.log('\nSem paciente nao da para seguir: todo registro clinico pende dele.');
  process.exitCode = 1;
} else {
  const P = criados.patientId;

  const edicaoPac = await chamar('PATCH', `/patients/${P}`, {
    clinicalConditions: ['[TESTE] condicao'],
  });
  registrar('editar paciente', edicaoPac);

  // ── 2. avaliacao fisica ───────────────────────────────────────────────────
  console.log('\n── avaliacoes ──');
  const fisica = await chamar('POST', '/assessments/physical', {
    patientId: P, weightKg: 65, heightCm: 165,
    skinfoldTricepsMm: 18, skinfoldSuprailiacMm: 16, skinfoldThighMm: 20,
    skinfoldProtocol: 'jackson_pollock_3',
    professionalNotes: MARCA,
  });
  registrar('criar avaliacao fisica', fisica);
  if (fisica.json?.id) {
    criados.outros.push(['avaliacao fisica', `/assessments/physical/${fisica.json.id}`]);
    registrar('editar avaliacao fisica',
      await chamar('PATCH', `/assessments/physical/${fisica.json.id}`, { weightKg: 66 }));
  }

  const nutri = await chamar('POST', '/assessments/nutritional', {
    patientId: P,
    professionalNotes: MARCA,
  });
  registrar('criar avaliacao nutricional', nutri);
  if (nutri.json?.id) {
    criados.outros.push(['avaliacao nutricional', `/assessments/nutritional/${nutri.json.id}`]);
    registrar('editar avaliacao nutricional',
      await chamar('PATCH', `/assessments/nutritional/${nutri.json.id}`, { professionalNotes: `${MARCA} editado` }));
  }

  // ── 3. plano alimentar ────────────────────────────────────────────────────
  console.log('\n── plano alimentar ──');
  const plano = await chamar('POST', '/meal-plans', { patientId: P, nome: MARCA });
  registrar('criar plano', plano);

  if (plano.json?.id) {
    const PL = plano.json.id;
    criados.outros.push(['plano', `/meal-plans/${PL}`]);

    // Item COM alimento da base: e o caminho que escala os nutrientes e copia
    // micronutrientes. Item digitado a mao nao exercita nada disso.
    const busca = await chamar('GET', '/foods/search?q=arroz');
    const alimento = Array.isArray(busca.json) ? busca.json[0] : busca.json?.items?.[0];
    if (alimento?.id) {
      const item = await chamar('POST', `/meal-plans/${PL}/items`, {
        refeicao: 'almoco', foodId: alimento.id, quantidadeG: 60,
      });
      const escalou = item.json && Number(item.json.kcal) > 0;
      registrar('adicionar item da base', item, escalou ? ' (nutrientes calculados)' : '');

      const lido = await chamar('GET', `/meal-plans/${PL}`);
      const micros = lido.json?.totais?.micronutrientes ?? {};
      const qtd = Object.keys(micros).length;
      registrar('plano devolve micronutrientes', { ok: qtd > 0, status: lido.status }, ` (${qtd} nutrientes)`);
    } else {
      console.log('AVISO busca de alimentos nao devolveu resultado — item da base nao testado');
    }
  }

  // ── 4. metas e suplementacao ──────────────────────────────────────────────
  console.log('\n── acompanhamento ──');
  const meta = await chamar('POST', '/goals', {
    patientId: P, goalType: 'weight_loss', description: MARCA,
    startDate: hoje, baselineValue: 70, targetValue: 65, targetUnit: 'kg',
  });
  registrar('criar meta', meta);
  if (meta.json?.id) {
    criados.outros.push(['meta', `/goals/${meta.json.id}`]);
    registrar('registrar checkpoint da meta',
      await chamar('POST', `/goals/${meta.json.id}/checkpoint`, { value: 68 }));
  }

  const sup = await chamar('POST', '/supplementation', {
    patientId: P, supplementName: MARCA, doseAmount: 5, doseUnit: 'g',
    frequencyPerDay: 1, isActive: true, startDate: hoje,
  });
  registrar('criar suplementacao', sup);
  if (sup.json?.id) {
    criados.outros.push(['suplementacao', `/supplementation/${sup.json.id}`]);
    registrar('editar suplementacao',
      await chamar('PATCH', `/supplementation/${sup.json.id}`, { doseAmount: 10 }));
  }

  // ── 5. exame laboratorial ─────────────────────────────────────────────────
  const lab = await chamar('POST', '/laboratory', {
    patientId: P, collectionDate: hoje, hemoglobinGDl: 13.5,
    professionalInterpretation: MARCA,
  });
  registrar('criar exame laboratorial', lab);
  if (lab.json?.id) {
    criados.outros.push(['exame', `/laboratory/${lab.json.id}`]);
    registrar('editar exame laboratorial',
      await chamar('PATCH', `/laboratory/${lab.json.id}`, { professionalInterpretation: `${MARCA} editado` }));
  }
}

// ── limpeza ─────────────────────────────────────────────────────────────────
console.log('\n── limpeza ──');
const sobraram = [];
for (const [nome, caminho] of criados.outros.reverse()) {
  const r = await chamar('DELETE', caminho);
  // 404/405 = a rota nao oferece DELETE; o registro some junto com o paciente.
  if (!r.ok && r.status !== 404 && r.status !== 405) sobraram.push(`${nome} (${caminho})`);
}
if (criados.patientId) {
  const r = await chamar('DELETE', `/patients/${criados.patientId}`);
  if (r.ok) {
    console.log(`paciente de teste removido (${criados.patientId})`);
  } else {
    sobraram.push(`paciente ${criados.patientId} — HTTP ${r.status}`);
  }
}
if (sobraram.length) {
  console.log('\nATENCAO — ficou dado de teste em producao:');
  for (const s of sobraram) console.log(`  ${s}`);
}

// ── veredito ────────────────────────────────────────────────────────────────
const falhas = passos.filter((p) => !p.ok);
console.log(`\n${passos.length} passo(s) · ${falhas.length} falha(s)`);
if (falhas.length) {
  console.log('\n=== GRAVACOES QUE FALHARAM ===');
  for (const f of falhas) console.log(`  ${f.nome} (HTTP ${f.status})`);
}
process.exitCode = falhas.length || sobraram.length ? 1 : 0;
