/**
 * Mede quantos alimentos da base recebem grupo de troca, e quem sobra.
 *
 *   node node_modules/ts-node/dist/bin.js scripts/medir-classificacao-ibge.ts
 *   node node_modules/ts-node/dist/bin.js scripts/medir-classificacao-ibge.ts --sobras
 *
 * Somente leitura.
 *
 * POR QUE EXISTE
 *
 * O `importar-ibge.mjs` gravava `grupo_alimentar: null` com o comentario "a
 * classificacao de troca e derivada da composicao, entao isto nao impede
 * substituicao". A segunda frase era falsa: quase todo ramo do
 * `classificarGrupoTroca` testa a string do grupo TACO, e sem ela o alimento
 * caia em `grupo: null`. Resultado medido em 22/10/2026: 1971 dos 2568
 * alimentos (77%) sem grupo, e TODOS os 1967 que tem medida caseira estavam
 * entre eles.
 *
 * Nenhum teste pegou porque os testes de substituicao usam alimentos
 * fabricados, todos com grupo. Esta medicao roda contra a base real — e e
 * para rodar DE NOVO depois de mexer nas regras, porque a pergunta "quantos
 * ficam de fora" nao se responde de memoria.
 */
import { readFileSync } from 'node:fs';
import { classificarGrupoTroca, type ParaClassificar } from '../src/modules/meal-plans/grupos-troca';

function carregarEnv(c: string) {
  try {
    for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
carregarEnv(require('node:path').join(__dirname, '..', '.env'));

const B = process.env.SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!B || !K) {
  console.log('Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}

interface LinhaDeAlimento {
  id: string;
  fonte: string | null;
  nome_padronizado: string;
  grupo_alimentar: string | null;
  energia_kcal: number | null;
  proteinas_g: number | null;
  carboidratos_g: number | null;
  lipidios_g: number | null;
  ativo: boolean;
}

async function principal() {
  const h = { apikey: K as string, Authorization: `Bearer ${K}` };

  const alimentos: LinhaDeAlimento[] = [];
  for (let de = 0; de < 50000; de += 1000) {
    const j = await fetch(
      `${B}/rest/v1/foods?select=id,fonte,nome_padronizado,grupo_alimentar,`
      + `energia_kcal,proteinas_g,carboidratos_g,lipidios_g,ativo&limit=1000&offset=${de}`,
      { headers: h },
    ).then((r) => r.json());
    if (!Array.isArray(j) || !j.length) break;
    alimentos.push(...j);
  }

  const comMedida = new Set<string>();
  for (let de = 0; de < 50000; de += 1000) {
    const j = await fetch(
      `${B}/rest/v1/food_measures?select=food_id&limit=1000&offset=${de}`, { headers: h },
    ).then((r) => r.json());
    if (!Array.isArray(j) || !j.length) break;
    for (const m of j) comMedida.add(m.food_id);
  }

  const ativos = alimentos.filter((a) => a.ativo);
  console.log(`${ativos.length} alimento(s) ativo(s); ${comMedida.size} com medida caseira.\n`);

  const porFonte: Record<string, { total: number; comGrupo: number; comMedida: number; comMedidaEGrupo: number }> = {};
  const sobras: LinhaDeAlimento[] = [];
  const porGrupo: Record<string, number> = {};

  for (const a of ativos) {
    const para: ParaClassificar = {
      nomePadronizado: a.nome_padronizado,
      grupoAlimentar: a.grupo_alimentar,
      energiaKcal: a.energia_kcal,
      proteinasG: a.proteinas_g,
      carboidratosG: a.carboidratos_g,
      lipidiosG: a.lipidios_g,
    };
    const c = classificarGrupoTroca(para);
    const fonte = a.fonte ?? '(sem fonte)';
    const linha = (porFonte[fonte] ??= { total: 0, comGrupo: 0, comMedida: 0, comMedidaEGrupo: 0 });
    linha.total += 1;
    if (c.grupo) {
      linha.comGrupo += 1;
      porGrupo[c.grupo] = (porGrupo[c.grupo] ?? 0) + 1;
    } else {
      sobras.push(a);
    }
    if (comMedida.has(a.id)) {
      linha.comMedida += 1;
      if (c.grupo) linha.comMedidaEGrupo += 1;
    }
  }

  console.log('por fonte:');
  for (const [fonte, n] of Object.entries(porFonte)) {
    const pct = ((n.comGrupo / n.total) * 100).toFixed(1);
    console.log(`  ${fonte.padEnd(12)} ${n.comGrupo}/${n.total} com grupo (${pct}%)`);
    console.log(`  ${''.padEnd(12)} ${n.comMedidaEGrupo}/${n.comMedida} dos que tem medida caseira`);
  }

  console.log('\npor grupo de troca:');
  for (const [g, n] of Object.entries(porGrupo).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(5)}  ${g}`);
  }

  console.log(`\nsem grupo: ${sobras.length}`);
  if (process.argv.includes('--sobras')) {
    console.log('\nquem sobra (ate 80):');
    for (const a of sobras.slice(0, 80)) console.log(`  ${a.nome_padronizado}`);
  }
}

principal();
