/**
 * Cria o bucket de anexos, PRIVADO.
 *
 * Privado nao e detalhe: foto de refeicao de paciente em bucket publico fica
 * acessivel por URL a quem descobrir o caminho, sem login e sem registro de
 * acesso. Todo download passa a exigir URL assinada com prazo.
 */
import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const nome = process.env.SUPABASE_STORAGE_BUCKET;
const h = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};
const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket`, {
  method: 'POST',
  headers: h,
  body: JSON.stringify({
    name: nome,
    id: nome,
    public: false,
    file_size_limit: 8 * 1024 * 1024,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  }),
});
console.log(`criar ${nome}: HTTP ${r.status} :: ${(await r.text()).slice(0, 200)}`);

const v = await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket/${nome}`, { headers: h });
const b = await v.json();
console.log('estado:', JSON.stringify({
  nome: b.name, publico: b.public, limite: b.file_size_limit, tipos: b.allowed_mime_types,
}));
