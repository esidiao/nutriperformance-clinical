/**
 * Importa alimentos de um CSV (TACO/TBCA/USDA exportado) para a tabela `foods`.
 *
 * Pré-requisito: `npm run build` (usa a lógica compilada em dist/).
 * Uso:  cd apps/api && railway run node scripts/import-foods-csv.js <arquivo.csv> <fonte> <versao>
 *   ex: railway run node scripts/import-foods-csv.js ./taco.csv taco "4a edicao"
 *
 * Idempotente: upsert por (fonte, fonte_id_externo). Linhas inválidas vão para
 * import_logs.detalhes (rejeitadas) e NÃO entram na base. Sem fonte_id_externo,
 * usa o nome como chave estável.
 */
const fs = require('fs');
const { Client } = require('pg');

let util;
try {
  // NestJS compila com rootDir incluindo "src" → dist/src/...
  util = require('../dist/src/modules/foods/foods-import.util.js');
} catch (e1) {
  try {
    util = require('../dist/modules/foods/foods-import.util.js');
  } catch (e2) {
    console.error('Util compilado não encontrado. Rode `npm run build` antes.', e1.message);
    process.exit(1);
  }
}

// CSV parser simples com suporte a aspas e separador , ou ;
function parseCsv(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let field = '', row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignore */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

async function main() {
  const [file, fonte = 'taco', versao = ''] = process.argv.slice(2);
  if (!file) { console.error('Informe o caminho do CSV.'); process.exit(1); }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) { console.error('DATABASE_URL ausente — use `railway run`.'); process.exit(1); }

  const licencaPorFonte = {
    taco: 'TACO/NEPA/UNICAMP — uso livre com atribuição',
    tbca: 'TBCA/FoRC/USP — verificar termos (uso comercial requer aval)',
    usda: 'USDA FoodData Central — domínio público (CC0)',
  };

  const raw = fs.readFileSync(file, 'utf8');
  const matrix = parseCsv(raw);
  const headers = matrix[0].map((h) => h.trim());
  const dataRows = matrix.slice(1).map((cols) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = cols[i]; });
    return o;
  });

  const opts = { fonte, fonteVersao: versao, licenca: licencaPorFonte[fonte] ?? 'verificar', confiabilidade: fonte === 'taco' || fonte === 'usda' ? 'alta' : 'media' };

  const ssl = process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString, ssl });
  await client.connect();

  // Fontes autoritativas (TACO/USDA): kcal incoerente é aviso, não rejeição.
  const trusted = fonte === 'taco' || fonte === 'usda' || fonte === 'tbca';

  let inseridas = 0, atualizadas = 0, rejeitadas = 0, comAvisos = 0;
  const erros = [];
  try {
    for (const r of dataRows) {
      const mapped = util.mapRow(r, opts);
      const { ok, errors, warnings } = util.validateFood(mapped, { strictKcal: !trusted });
      if (!ok) { rejeitadas++; if (erros.length < 50) erros.push({ nome: mapped.nome_padronizado, errors }); continue; }
      if (warnings && warnings.length) comAvisos++;
      const externo = mapped.fonte_id_externo ?? mapped.nome_padronizado;
      const res = await client.query(
        `INSERT INTO foods (nome_padronizado, grupo_alimentar, energia_kcal, carboidratos_g, proteinas_g, lipidios_g,
            fibras_g, sodio_mg, calcio_mg, ferro_mg, potassio_mg, magnesio_mg, zinco_mg,
            fonte, fonte_id_externo, fonte_versao, confiabilidade, licenca)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (fonte, fonte_id_externo) DO UPDATE SET
            nome_padronizado=EXCLUDED.nome_padronizado, grupo_alimentar=EXCLUDED.grupo_alimentar,
            energia_kcal=EXCLUDED.energia_kcal, carboidratos_g=EXCLUDED.carboidratos_g,
            proteinas_g=EXCLUDED.proteinas_g, lipidios_g=EXCLUDED.lipidios_g,
            fibras_g=EXCLUDED.fibras_g, sodio_mg=EXCLUDED.sodio_mg, calcio_mg=EXCLUDED.calcio_mg,
            ferro_mg=EXCLUDED.ferro_mg, potassio_mg=EXCLUDED.potassio_mg, magnesio_mg=EXCLUDED.magnesio_mg,
            zinco_mg=EXCLUDED.zinco_mg, fonte_versao=EXCLUDED.fonte_versao,
            confiabilidade=EXCLUDED.confiabilidade, data_importacao=now()
         RETURNING (xmax = 0) AS inserted`,
        [mapped.nome_padronizado, mapped.grupo_alimentar, mapped.energia_kcal, mapped.carboidratos_g, mapped.proteinas_g,
         mapped.lipidios_g, mapped.fibras_g, mapped.sodio_mg, mapped.calcio_mg, mapped.ferro_mg, mapped.potassio_mg,
         mapped.magnesio_mg, mapped.zinco_mg,
         mapped.fonte, externo, mapped.fonte_versao, mapped.confiabilidade, mapped.licenca],
      );
      if (res.rows[0].inserted) inseridas++; else atualizadas++;
    }

    await client.query(
      `INSERT INTO import_logs (fonte, linhas_inseridas, linhas_atualizadas, linhas_rejeitadas, detalhes)
       VALUES ($1,$2,$3,$4,$5)`,
      [fonte, inseridas, atualizadas, rejeitadas, JSON.stringify({ com_avisos: comAvisos, amostra_erros: erros })],
    );
    await client.query(
      `INSERT INTO data_sources (nome, descricao, licenca, versao, ultimo_import)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (nome) DO UPDATE SET versao=EXCLUDED.versao, ultimo_import=now()`,
      [fonte, `Importação ${fonte}`, opts.licenca, versao],
    );

    console.log(`Importação concluída — fonte=${fonte}`);
    console.log(`  inseridas: ${inseridas} | atualizadas: ${atualizadas} | rejeitadas: ${rejeitadas} | com avisos: ${comAvisos}`);
    if (rejeitadas) console.log(`  (amostra de erros registrada em import_logs)`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('Falha na importação:', e.message); process.exit(1); });
