import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Catraca: `last_login_at` nao volta sem decisao consciente.
 *
 * A coluna existia na entidade, nunca era escrita, e estava NULA para os 14
 * usuarios — inclusive os que usam o sistema diariamente. Em 30/10/2026 ela
 * quase sustentou a conclusao errada de que uma profissional nunca havia
 * entrado no sistema.
 *
 * O jeito natural de "corrigir" seria passar a gravar. Isso criaria uma segunda
 * copia de um dado que o Supabase Auth ja mantem em `auth.users
 * .last_sign_in_at` — e duas copias do mesmo fato so podem divergir.
 *
 * Se alguem redeclarar a coluna, este teste falha e obriga a ler o comentario
 * da entidade antes de decidir. Nao e proibicao: e exigir que a decisao seja
 * tomada de novo, por quem souber de algo que eu nao sabia.
 */
describe('User (entidade)', () => {
  const fonte = readFileSync(join(__dirname, 'user.entity.ts'), 'utf8');
  const codigo = fonte
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
    .join('\n');

  it('nao declara last_login_at', () => {
    expect(codigo).not.toMatch(/last_login_at/);
    expect(codigo).not.toMatch(/lastLoginAt/);
  });

  it('o comentario que explica a ausencia continua la', () => {
    // Sem a explicacao, a ausencia parece esquecimento e o proximo leitor
    // "conserta" adicionando a coluna de volta.
    expect(fonte).toMatch(/last_sign_in_at/);
  });

  it('ainda declara is_active, que agora e aplicado de verdade', () => {
    // O par do defeito: `is_active` tambem nao era lido em nenhum lugar. A
    // diferenca e que esse ficou, e passou a valer — ver
    // `common/contas-ativas.service.ts`. Se a coluna sumir da entidade, a
    // conferencia do guard perde a base.
    expect(codigo).toMatch(/name: 'is_active'/);
  });
});
