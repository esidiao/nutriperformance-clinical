/**
 * Roda a regra de plural sobre TODAS as medidas caseiras da base.
 *
 *   node node_modules/ts-node/dist/bin.js scripts/conferir-plurais-das-medidas.ts
 *
 * Somente leitura.
 *
 * POR QUE EXISTE
 *
 * O comentario de `medida-caseira.ts` afirmava que a base nao tinha medida
 * terminada em "ao"/"ão", e por isso a regra podia deixar esse caso de lado.
 * Em 22/10/2026 eu fui conferir na base: tem duas — `copo de requeijao` e
 * `porcao`. A primeira flexiona certo (o "ao" esta na locucao, depois da
 * preposicao); a segunda virava "porcaos", que nao e palavra, na frase que o
 * PACIENTE le na lista de trocas.
 *
 * Nenhum teste pegou porque todos os testes usavam exemplos escolhidos por
 * mim. A base e que decide quais casos existem, e e nela que esta pergunta se
 * responde. Por isso este script: ele enumera o que ha, nao o que eu lembro.
 *
 * O que ele acusa:
 *   - plural que termina em "aos"/"ãos" (quase sempre errado em medida);
 *   - medida que a regra deixou IGUAL no plural sem ser por parentetico nem
 *     por ja terminar em "s" — ou seja, caso que a regra nao soube flexionar.
 */
import { readFileSync } from 'node:fs';
import { pluralizarMedida } from '../../web/lib/medida-caseira';

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

async function principal() {
  const h = { apikey: K, Authorization: `Bearer ${K}` };
  const vistas = new Set<string>();
  for (let de = 0; de < 50000; de += 1000) {
    const j = await fetch(
      `${B}/rest/v1/food_measures?select=medida&limit=1000&offset=${de}`, { headers: h },
    ).then((r) => r.json());
    if (!Array.isArray(j) || !j.length) break;
    for (const m of j) vistas.add(m.medida);
  }

  const medidas = [...vistas].sort();
  console.log(`${medidas.length} medida(s) distinta(s) na base.\n`);

  const suspeitas: Array<[string, string, string]> = [];
  for (const m of medidas) {
    const plural = pluralizarMedida(m);
    const parentetico = /[)(]/.test(m);
    const jaPlural = /s$/i.test(m);

    if (/(aos|ãos)$/i.test(plural)) {
      suspeitas.push([m, plural, 'plural em "aos": a regra caiu na regra de vogal']);
    } else if (plural === m && !parentetico && !jaPlural) {
      suspeitas.push([m, plural, 'ficou igual: a regra nao soube flexionar']);
    }
  }

  if (!suspeitas.length) {
    console.log('Nenhuma medida da base cai em caso que a regra nao saiba tratar.');
  } else {
    console.log(`${suspeitas.length} medida(s) a conferir:\n`);
    for (const [m, plural, motivo] of suspeitas) {
      console.log(`  "${m}" -> "${plural}"`);
      console.log(`     ${motivo}`);
    }
    console.log(
      '\nO plural de "ão" nao e derivavel (pao/paes, limao/limoes, irmao/irmaos).\n'
      + 'Acrescentar a palavra em PLURAIS_CONHECIDOS, em medida-caseira.ts, com o\n'
      + 'plural escrito a mao — ou deixar no singular, que e feio e honesto.',
    );
    process.exitCode = 1;
  }

}

principal();
