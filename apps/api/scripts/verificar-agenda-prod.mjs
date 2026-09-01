// Verificação ponta a ponta da agenda em PRODUÇÃO.
//
// Não usa senha de ninguém: emite um magic link pela API administrativa do
// Supabase e o troca por um access_token. É o mesmo token que o app usaria,
// então o JwtAuthGuard, o RolesGuard e as policies de RLS são exercitados de
// verdade — não é um teste que ignora autorização.
//
// Escreve UMA consulta marcada como TESTE e a cancela no final. Não existe
// rota de exclusão (por desenho: audit_logs referencia os registros), então a
// consulta fica no banco com status `cancelada`.
//
// Uso: node apps/api/scripts/verificar-agenda-prod.mjs <email-do-profissional>
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';

function carregarEnv(caminho) {
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
try {
  carregarEnv(new URL('../../web/.env.local', import.meta.url));
  process.env.SUPABASE_ANON_KEY ||= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
} catch {}

const API = process.env.API_TESTE_URL ?? 'https://nutriperformance-clinical.onrender.com';
const email = process.argv[2];
if (!email) { console.error('Informe o email do profissional.'); process.exit(1); }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.'); process.exit(1); }

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const passos = [];
const registra = (nome, ok, detalhe) => { passos.push({ nome, ok, detalhe }); console.log(`${ok ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? ' — ' + detalhe : ''}`); };

// 1. Token sem senha
const { data: link, error: erroLink } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
if (erroLink) { console.error('Não consegui gerar o link:', erroLink.message); process.exit(1); }
const anon = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY ?? SERVICE_KEY, { auth: { persistSession: false } });
const { data: sessao, error: erroOtp } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (erroOtp) { console.error('Não consegui trocar o link por sessão:', erroOtp.message); process.exit(1); }
const token = sessao.session.access_token;
registra('autenticacao sem senha', true, `${email} (role=${sessao.user.user_metadata?.role ?? '?'})`);

const chamar = async (metodo, rota, corpo) => {
  const r = await fetch(`${API}${rota}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};

export { chamar, registra, passos, sessao };

// ---------------------------------------------------------------------------
// Roteiro. Cada passo verifica UMA regra de domínio contra produção.
// ---------------------------------------------------------------------------
const iso = (d) => d.toISOString();
const daqui = (dias, hora) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + dias); d.setUTCHours(hora, 0, 0, 0); return d; };

// 2. Listagem
const lista = await chamar('GET', '/appointments');
registra('GET /appointments autenticado', lista.status === 200, `HTTP ${lista.status}, ${Array.isArray(lista.json) ? lista.json.length : '?'} consulta(s)`);

// 3. Um paciente do workspace
const pacientes = await chamar('GET', '/patients');
const arr = Array.isArray(pacientes.json) ? pacientes.json : pacientes.json?.data ?? [];
const paciente = arr[0];
registra('GET /patients', pacientes.status === 200 && !!paciente, paciente ? `usando "${paciente.name ?? paciente.nome ?? paciente.id}"` : `HTTP ${pacientes.status} — ${JSON.stringify(pacientes.json).slice(0, 200)}`);
if (!paciente) { console.log('\nSem paciente, nao da para testar o agendamento.'); process.exit(1); }

const dia = daqui(30, 13); // 30 dias no futuro, longe de qualquer agenda real
const diaStr = iso(dia).slice(0, 10);

// 4. Horários livres antes
const livresAntes = await chamar('GET', `/appointments/horarios-livres?dia=${diaStr}&duracaoMin=60`);
const qtdAntes = Array.isArray(livresAntes.json) ? livresAntes.json.length : -1;
registra('GET /horarios-livres', livresAntes.status === 200, `HTTP ${livresAntes.status}, ${qtdAntes} horario(s) livre(s)`);

// 5. Criar
const criada = await chamar('POST', '/appointments', {
  patientId: paciente.id, inicio: iso(dia), duracaoMin: 60, tipo: 'retorno',
  observacoes: '[TESTE AUTOMATIZADO] verificacao de deploy — pode ignorar',
});
registra('POST /appointments cria', criada.status === 201 || criada.status === 200, `HTTP ${criada.status}`);
const id = criada.json?.id;
if (!id) { console.log('\nResposta:', JSON.stringify(criada.json)); process.exit(1); }

// 6. Conflito — regra central da agenda
const conflito = await chamar('POST', '/appointments', {
  patientId: paciente.id, inicio: iso(new Date(dia.getTime() + 30 * 60000)), duracaoMin: 60, tipo: 'retorno',
});
registra('horario sobreposto e recusado', conflito.status === 409, `HTTP ${conflito.status} — "${conflito.json?.message ?? ''}"`);

// 7. Encostar não é colidir
const encosta = await chamar('POST', '/appointments', {
  patientId: paciente.id, inicio: iso(new Date(dia.getTime() + 60 * 60000)), duracaoMin: 60, tipo: 'retorno',
  observacoes: '[TESTE AUTOMATIZADO] encostado — pode ignorar',
});
registra('horario encostado e aceito', encosta.status === 201 || encosta.status === 200, `HTTP ${encosta.status}`);
const idEncosta = encosta.json?.id;

// 8. Marcar "realizada" antes da hora deve falhar
const cedo = await chamar('PATCH', `/appointments/${id}/status`, { status: 'realizada' });
registra('"realizada" antes da hora e recusada', cedo.status >= 400, `HTTP ${cedo.status} — "${cedo.json?.message ?? ''}"`);

// 9. Confirmar deve passar
const confirma = await chamar('PATCH', `/appointments/${id}/status`, { status: 'confirmada' });
registra('confirmar consulta futura', confirma.status === 200, `HTTP ${confirma.status}`);

// 10. Limpeza: cancelar as duas de teste
for (const alvo of [id, idEncosta].filter(Boolean)) {
  await chamar('PATCH', `/appointments/${alvo}/status`, { status: 'cancelada', motivo: 'Teste automatizado de deploy' });
}
const livresDepois = await chamar('GET', `/appointments/horarios-livres?dia=${diaStr}&duracaoMin=60`);
const qtdDepois = Array.isArray(livresDepois.json) ? livresDepois.json.length : -1;
registra('cancelamento libera o horario', qtdDepois === qtdAntes, `${qtdAntes} livres antes, ${qtdDepois} depois do cancelamento`);

const falhas = passos.filter((p) => !p.ok);
console.log(`\n${passos.length - falhas.length}/${passos.length} passos OK`);
process.exit(falhas.length ? 1 : 0);
