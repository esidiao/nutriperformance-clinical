/**
 * O banco apontado é local?
 *
 * POR QUE ISTO EXISTE
 *
 * O `synchronize` do TypeORM ALTERA O SCHEMA para alinhá-lo às entidades:
 * remove colunas que não estão no código, derruba chaves estrangeiras,
 * apaga tipos. Num banco local isso é conveniência; em qualquer outro, é
 * destruição.
 *
 * A guarda anterior era `synchronize: !isProduction` — ou seja, decidia pelo
 * NODE_ENV, não por QUAL banco. Com `DATABASE_URL` apontando para produção e
 * NODE_ENV=development, a sincronização rodaria contra produção.
 *
 * Não é hipótese distante. Em 21/10/2026, subindo a API em modo dev, o
 * TypeORM tentou derrubar as chaves estrangeiras de users, patients,
 * audit_logs, nutritional_assessments e mais uma dúzia de tabelas, e remover
 * `physical_assessments.secondary_goals`. Naquele caso o destino era o banco
 * LOCAL (`DB_HOST=localhost`), então não houve dano em produção — mas a única
 * coisa que separava os dois cenários era o valor de uma variável de
 * ambiente. E a transação só não foi confirmada porque bateu num erro não
 * relacionado (`não é possível remover tipo goal_type`).
 *
 * A REGRA CERTA É SOBRE O DESTINO, NÃO SOBRE O MODO
 *
 * Alterar automaticamente um schema que não foi criado nesta máquina está
 * errado em qualquer ambiente. Então a pergunta deixa de ser "estou em
 * produção?" e passa a ser "este banco é local?".
 *
 * E a resposta padrão é NÃO: destino que não dá para reconhecer é tratado
 * como remoto. Errar para o lado de não sincronizar custa uma migração
 * escrita à mão; errar para o outro custa o banco.
 */

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/** Hospedeiro de uma URL de conexão, ou null se não der para extrair. */
export function hospedeiroDaUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    // URL malformada: não dá para afirmar que é local.
    return null;
  }
}

export function hospedeiroEhLocal(hospedeiro: string | null | undefined): boolean {
  if (!hospedeiro) return false;
  const h = hospedeiro.toLowerCase().trim();
  return HOSTS_LOCAIS.has(h) || h.endsWith('.localhost');
}

/**
 * Decide se o `synchronize` pode ser ligado.
 *
 * Exige as DUAS condições: fora de produção E apontando para um banco local.
 * Qualquer dúvida sobre o destino resulta em `false`.
 */
export function podeSincronizar(opcoes: {
  nodeEnv?: string | null;
  databaseUrl?: string | null;
  dbHost?: string | null;
}): boolean {
  if (opcoes.nodeEnv === 'production') return false;

  const hospedeiro = opcoes.databaseUrl
    ? hospedeiroDaUrl(opcoes.databaseUrl)
    : (opcoes.dbHost ?? null);

  return hospedeiroEhLocal(hospedeiro);
}

/** Explica a decisão, para o log do boot dizer por que não sincronizou. */
export function motivoDeNaoSincronizar(opcoes: {
  nodeEnv?: string | null;
  databaseUrl?: string | null;
  dbHost?: string | null;
}): string | null {
  if (podeSincronizar(opcoes)) return null;
  if (opcoes.nodeEnv === 'production') return 'NODE_ENV é production';

  const hospedeiro = opcoes.databaseUrl
    ? hospedeiroDaUrl(opcoes.databaseUrl)
    : (opcoes.dbHost ?? null);

  if (!hospedeiro) {
    return 'não foi possível identificar o hospedeiro do banco — tratado como remoto';
  }
  return `o banco em "${hospedeiro}" não é local`;
}
