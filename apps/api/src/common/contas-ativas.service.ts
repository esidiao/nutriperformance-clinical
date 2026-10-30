import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Se a conta e o workspace do token ainda valem.
 *
 * ============================== POR QUE EXISTE ==============================
 *
 * `users.is_active` e `workspaces.is_active` existiam, eram escritos pelo
 * painel administrativo e NAO eram lidos em nenhum ponto do caminho de
 * requisicao. O `JwtAuthGuard` montava a identidade so com os claims do token
 * e nunca consultava o banco.
 *
 * O efeito pratico: `PATCH /admin/workspaces/:id/suspend` gravava
 * `is_active = false`, a listagem do painel passava a mostrar "suspenso", e
 * todo mundo daquele workspace continuava entrando e trabalhando. Desativar um
 * usuario tambem nao tirava o acesso dele.
 *
 * Isso foi encontrado em 30/10/2026 ao conferir se a conta de uma profissional
 * que havia saido ainda tinha acesso. Ela nao tinha — mas pelo banimento no
 * Supabase Auth, nao por nada que o sistema fizesse. Os dois campos eram
 * decoracao, e decoracao que parece controle e pior que controle nenhum: o
 * administrador clica, ve "suspenso" na tela, e acredita.
 *
 * ============================== FALHA FECHADO ==============================
 *
 * Qualquer duvida nega. Sem linha em `users`, sem workspace, erro de banco:
 * nega. Um token prova quem assinou, nao que a conta ainda exista.
 *
 * Em particular, conta autenticada SEM linha em `users` passa a ser negada.
 * Eram cinco em 30/10/2026: quatro de teste (`@nutritest.com`,
 * `@performance.com`) e `sidiao@i9educar.com`, cujo token aponta para um
 * workspace que nao existe no banco — ou seja, ja estava quebrada, so nao
 * avisava. Nenhuma conta de uso real foi afetada.
 */
@Injectable()
export class ContasAtivasService {
  private readonly log = new Logger(ContasAtivasService.name);

  /**
   * Cache curto, e a duracao e uma escolha, nao um detalhe.
   *
   * A API roda em virginia e o banco em sa-east-1: cada consulta atravessa um
   * continente. Uma por requisicao somaria essa travessia a TODA chamada.
   *
   * Em troca, uma suspensao leva ate `TTL_MS` para valer. Trinta segundos e o
   * maximo que me parece defensavel para "o administrador clicou em suspender
   * e a pessoa continua dentro". Aumentar isso reabre, em menor escala, o
   * defeito que este arquivo existe para fechar.
   */
  private static readonly TTL_MS = 30_000;

  /**
   * Teto do cache. So token valido chega aqui, entao o crescimento e limitado
   * ao numero de contas — mas um teto explicito evita que um dia isso vire
   * vazamento silencioso num processo de vida longa.
   */
  private static readonly MAX_ENTRADAS = 10_000;

  private readonly cache = new Map<string, { expiraEm: number; motivo: string | null }>();

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Devolve o motivo para NEGAR, ou `null` quando esta tudo em ordem.
   *
   * @param sub        `sub` do token — que e tambem `users.id`
   *                   (ver `common/identidade-da-conta.ts`).
   * @param workspaceId workspace que o token declara. Conferimos ESTE, nao o
   *                   `users.workspace_id`, porque e este que os servicos usam
   *                   para filtrar: e o workspace que a requisicao vai acessar.
   */
  async motivoParaNegar(sub: string, workspaceId: string): Promise<string | null> {
    const chave = sub + '|' + workspaceId;
    const agora = Date.now();

    const emCache = this.cache.get(chave);
    if (emCache && emCache.expiraEm > agora) return emCache.motivo;

    const motivo = await this.consultar(sub, workspaceId);

    if (this.cache.size >= ContasAtivasService.MAX_ENTRADAS) this.cache.clear();
    this.cache.set(chave, { expiraEm: agora + ContasAtivasService.TTL_MS, motivo });

    return motivo;
  }

  /** Esquece o que estiver em cache. Para testes e para o painel administrativo. */
  limparCache(): void {
    this.cache.clear();
  }

  private async consultar(sub: string, workspaceId: string): Promise<string | null> {
    let linhas: Array<{ usuario_ativo: boolean | null; workspace_ativo: boolean | null }>;
    try {
      linhas = await this.db.query(
        `SELECT u.is_active AS usuario_ativo, w.is_active AS workspace_ativo
           FROM users u
           LEFT JOIN workspaces w ON w.id = $2
          WHERE u.id = $1`,
        [sub, workspaceId],
      );
    } catch (erro) {
      // Banco fora do ar nega. Deixar passar aqui transformaria indisponibilidade
      // do banco em "todo mundo entra sem conferencia" — exatamente a condicao
      // que este servico existe para impedir.
      this.log.error(
        'nao foi possivel conferir se a conta esta ativa; negando por precaucao',
        erro instanceof Error ? erro.stack : String(erro),
      );
      return 'nao foi possivel confirmar o estado da sua conta. Tente novamente em instantes.';
    }

    const linha = linhas[0];

    if (!linha) {
      return 'conta sem perfil cadastrado no sistema. Contate o administrador.';
    }
    if (linha.usuario_ativo === false) {
      return 'conta desativada.';
    }
    if (linha.workspace_ativo == null) {
      return 'o espaco de trabalho da sua conta nao existe mais. Contate o administrador.';
    }
    if (linha.workspace_ativo === false) {
      return 'o espaco de trabalho da sua conta esta suspenso.';
    }
    return null;
  }
}
