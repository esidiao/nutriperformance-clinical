/**
 * Como o registro profissional aparece num documento clínico.
 *
 * ========================= O DADO É AMBÍGUO NA BASE ========================
 *
 * `council_type` guarda o conselho FEDERAL (CFN, CONFEF) e `council_number`
 * guarda o registro REGIONAL, que já vem com o próprio prefixo:
 *
 *     tipo="CFN"     numero="CRN-3 12345"       uf="SP"
 *     tipo="CONFEF"  numero="054321-G/SP"       uf="SP"
 *     tipo="CONFEF"  numero="CREF-0 000000-G/SP" uf="SP"
 *
 * Concatenar os dois, que era o que o PDF fazia, produz **"CFN CRN-3 12345"**
 * — e quem registra um nutricionista é o CRN, não o CFN. Num documento que
 * chega ao paciente, isso é identificação errada de quem assina.
 *
 * Conferido na base em 29/10/2026: dos seis registros preenchidos, QUATRO
 * ficariam com o acrônimo duplicado e um com a UF repetida.
 *
 * =============================== A REGRA ===================================
 *
 * O número manda. Se ele já traz o acrônimo do conselho, é ele que vale e o
 * tipo não entra. Se não traz, o tipo entra na frente. A UF só é acrescentada
 * quando ainda não está lá.
 *
 * Não é adivinhação elegante, é a forma de conviver com um campo que foi
 * preenchido de dois jeitos. O jeito certo seria um campo só, com o registro
 * completo — e isso é mudança de cadastro, não de formatação.
 */

/** Conselhos cujo acrônimo pode já estar dentro do número. */
const ACRONIMOS = /^(CRN|CREF|CRM|CRF|CRP|COREN|CFN|CONFEF)\b/i;

export function registroProfissional(
  tipo: string | null | undefined,
  numero: string | null | undefined,
  uf: string | null | undefined,
): string | null {
  const n = (numero ?? '').trim();
  const t = (tipo ?? '').trim();
  if (!n) return null;

  const base = ACRONIMOS.test(n) ? n : (t ? `${t} ${n}` : n);

  const u = (uf ?? '').trim();
  if (!u) return base;
  // "054321-G/SP" com uf "SP": a UF já está no número.
  const jaTemUf = new RegExp(`/\\s*${u}\\s*$`, 'i').test(base);
  return jaTemUf ? base : `${base}/${u}`;
}
