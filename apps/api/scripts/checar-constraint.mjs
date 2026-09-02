// Tenta gravar uma linha invalida para provar que a CHECK esta ativa.
// Se a constraint existir, o banco RECUSA e nada e criado.
import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json',
            Prefer: 'return=representation' };

const ws = (await (await fetch(`${U}/rest/v1/workspaces?select=id&limit=1`, { headers: h })).json())[0];
if (!ws) { console.log('sem workspace para testar'); process.exit(0); }

// Invalido: modelo COM paciente. A CHECK tem que recusar.
const r = await fetch(`${U}/rest/v1/meal_plans`, {
  method: 'POST', headers: h,
  body: JSON.stringify({
    workspace_id: ws.id, created_by: ws.id, nome: '[TESTE] constraint',
    is_template: true, patient_id: ws.id,
  }),
});
const corpo = await r.text();
const recusou = !r.ok && corpo.includes('meal_plans_template_check');
console.log(`modelo COM paciente -> HTTP ${r.status}`);
console.log(recusou ? 'OK    a CHECK recusou, como deve' : `FALHA a CHECK nao atuou :: ${corpo.slice(0,200)}`);

if (r.ok) {
  const criado = JSON.parse(corpo)[0];
  await fetch(`${U}/rest/v1/meal_plans?id=eq.${criado.id}`, { method: 'DELETE', headers: h });
  console.log('linha de teste removida');
}
