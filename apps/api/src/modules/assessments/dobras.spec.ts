import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guarda estrutural: os sítios de dobra que os protocolos usados exigem
 * precisam existir como coluna.
 *
 * A entidade tinha 6 dobras e parecia completa. Faltava só a axilar média —
 * e sem ela o protocolo de Jackson & Pollock de 7 dobras não tem onde ser
 * gravado. Ninguém percebeu porque a tela só oferecia o de 3, então a lacuna
 * nunca era exercitada: o pedido veio da nutricionista, não de um teste.
 *
 * Este teste olha o CÓDIGO-FONTE da entidade. Que a coluna exista no banco de
 * produção é outra pergunta, respondida por `scripts/varredura-schema.mjs`.
 */
const fonte = readFileSync(
  join(__dirname, 'physical-assessment.entity.ts'),
  'utf8',
);

/** Os 7 sítios de Jackson & Pollock, com o nome de coluna esperado. */
const SITIOS_JP7: Array<[string, string]> = [
  ['peitoral', 'skinfold_chest_mm'],
  ['axilar média', 'skinfold_midaxillary_mm'],
  ['tríceps', 'skinfold_triceps_mm'],
  ['subescapular', 'skinfold_subscapular_mm'],
  ['abdominal', 'skinfold_abdominal_mm'],
  ['supra-ilíaca', 'skinfold_suprailiac_mm'],
  ['coxa', 'skinfold_thigh_mm'],
];

describe('dobras cutâneas — sítios disponíveis', () => {
  it.each(SITIOS_JP7)('tem coluna para %s', (_nome, coluna) => {
    expect(fonte).toContain(`name: '${coluna}'`);
  });

  it('cobre os 7 sítios de Jackson & Pollock', () => {
    // O de 3 dobras é subconjunto deste: feminino usa tríceps/supra-ilíaca/
    // coxa, masculino usa peitoral/abdominal/coxa. Cobrindo os 7, os dois
    // protocolos cabem.
    const faltando = SITIOS_JP7
      .filter(([, c]) => !fonte.includes(`name: '${c}'`))
      .map(([n]) => n);
    expect(faltando).toEqual([]);
  });

  it('guarda QUAL protocolo gerou os valores', () => {
    // Sem isto um conjunto de dobras não se interpreta: o mesmo sítio entra
    // em equações diferentes conforme o protocolo e o sexo.
    expect(fonte).toContain(`name: 'skinfold_protocol'`);
  });

  it('a verificação enxerga uma coluna ausente', () => {
    // Sem isto o teste acima passaria mesmo se parasse de casar — foi o que
    // aconteceu com a guarda de entidades deste projeto, que passava porque
    // não encontrava nada para verificar.
    expect(fonte).not.toContain(`name: 'skinfold_inexistente_mm'`);
  });
});
