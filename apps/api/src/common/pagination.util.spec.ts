import { clampInt, clampOffset } from './pagination.util';

describe('pagination.util', () => {
  it('mantém valores dentro da faixa', () => {
    expect(clampInt(30, 50, 200)).toBe(30);
    expect(clampInt('30', 50, 200)).toBe(30);
  });

  it('aplica o teto', () => {
    expect(clampInt(999999, 50, 200)).toBe(200);
  });

  it('aplica o piso', () => {
    expect(clampInt(0, 50, 200)).toBe(1);
    expect(clampInt(-10, 50, 200)).toBe(1);
  });

  // O motivo de existir do util: Math.max(1, NaN) é NaN, e o NaN chegava
  // até o `take` do TypeORM como `LIMIT NaN`.
  it('cai no padrão quando o valor não é numérico', () => {
    expect(clampInt('abc', 50, 200)).toBe(50);
    expect(clampInt(NaN, 50, 200)).toBe(50);
    expect(clampInt(undefined, 50, 200)).toBe(50);
    expect(clampInt(null, 50, 200)).toBe(50);
    expect(clampInt(Infinity, 50, 200)).toBe(50);
    expect(clampInt('', 50, 200)).toBe(50);
  });

  it('trunca fracionários (LIMIT precisa de inteiro)', () => {
    expect(clampInt('10.7', 50, 200)).toBe(10);
  });

  it('clampOffset aceita zero e recusa negativo', () => {
    expect(clampOffset(0)).toBe(0);
    expect(clampOffset(-5)).toBe(0);
    expect(clampOffset('abc')).toBe(0);
    expect(clampOffset(120)).toBe(120);
  });
});
