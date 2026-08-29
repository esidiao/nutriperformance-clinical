/**
 * Normaliza `limit`/`offset` vindos de query string.
 *
 * Dois problemas que os clamps espalhados pelos serviços não cobriam:
 *  - `Math.min(max, Math.max(1, NaN))` devolve NaN (Math.max propaga NaN), e
 *    `?limit=abc` virava `LIMIT NaN` — erro 500 do Postgres em vez do padrão;
 *  - `GET /tokens/history?limit=999999` não tinha teto nenhum e devolvia o
 *    histórico inteiro do workspace numa requisição.
 */
export function clampInt(value: unknown, fallback: number, max: number, min = 1): number {
  // `null` e `''` significam "não informado", não zero: `Number(null)` é 0 e
  // `Number('')` é 0, então `?limit=` (vazio) cairia no piso 1 em vez do padrão.
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Igual a `clampInt`, mas para deslocamentos (aceita zero). */
export function clampOffset(value: unknown, max = 100_000): number {
  return clampInt(value, 0, max, 0);
}
