import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenCost } from './token-cost.entity';
import { TOKEN_OPERATION_KEY } from '../../common/guards/token-balance.guard';

/**
 * Confere no boot que toda rota marcada com @RequiresTokens tem preço em
 * `token_costs`.
 *
 * O motivo é a linha `if (!workspace || !cost) return true` do
 * TokenBalanceGuard: sem preço cadastrado, o portão de saldo é PULADO. Não é
 * uma operação de graça — é uma chamada paga ao Gemini liberada sem conferir
 * se o workspace pode pagar. A cobrança só falha depois, com a inferência já
 * feita: a plataforma paga e o usuário recebe um erro.
 *
 * Cinco operações ficaram assim por meses. Nenhum teste pegaria: os testes
 * mockam o repositório de preços, e o guard "funcionava" — devolvia true.
 *
 * Por isso a verificação é no boot e contra o banco de verdade. Ela derruba a
 * subida do processo, porque um preço faltando é erro de configuração, e erro
 * de configuração descoberto no deploy custa menos que descoberto na fatura.
 */
@Injectable()
export class PrecoConfiguradoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PrecoConfiguradoService.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    @InjectRepository(TokenCost) private readonly costRepo: Repository<TokenCost>,
  ) {}

  /** Operações declaradas por @RequiresTokens em qualquer controller. */
  operacoesDeclaradas(): string[] {
    const encontradas = new Set<string>();

    for (const wrapper of this.discovery.getControllers()) {
      const instancia = wrapper.instance;
      if (!instancia) continue;

      const daClasse = this.reflector.get<string>(TOKEN_OPERATION_KEY, wrapper.metatype as any);
      if (daClasse) encontradas.add(daClasse);

      const prototipo = Object.getPrototypeOf(instancia);
      for (const metodo of this.scanner.getAllMethodNames(prototipo)) {
        const op = this.reflector.get<string>(TOKEN_OPERATION_KEY, prototipo[metodo]);
        if (op) encontradas.add(op);
      }
    }

    return [...encontradas].sort();
  }

  async onApplicationBootstrap(): Promise<void> {
    const declaradas = this.operacoesDeclaradas();
    if (!declaradas.length) return;

    let precificadas: Set<string>;
    try {
      const linhas = await this.costRepo.find();
      precificadas = new Set(linhas.map((l) => l.operation));
    } catch (e: any) {
      // Banco indisponível no boot é problema transitório e tem tratamento
      // próprio. Derrubar o processo aqui transformaria uma oscilação de rede
      // em ciclo de reinício — o oposto do que esta verificação quer.
      this.logger.warn(
        `Não foi possível conferir os preços de tokens no boot: ${e?.message}`,
      );
      return;
    }

    const semPreco = declaradas.filter((op) => !precificadas.has(op));
    if (semPreco.length) {
      throw new Error(
        'Operações marcadas com @RequiresTokens e sem linha em token_costs: '
        + `${semPreco.join(', ')}. `
        + 'Sem preço, o TokenBalanceGuard libera a chamada paga sem conferir saldo. '
        + 'Cadastre o preço ou remova o @RequiresTokens da rota.',
      );
    }

    // Preço sem uso NÃO é conferido aqui. Boa parte das operações cobra por
    // `consume()` sem @RequiresTokens na rota — o RAG e a transcrição de áudio
    // conferem saldo no serviço, com mensagem própria. Comparar os dois
    // conjuntos aqui acusaria essas como órfãs, e um aviso que erra vira um
    // aviso que ninguém lê. Quem faz essa comparação é
    // scripts/varredura-tokens.mjs, contra produção.
    this.logger.log(`Preços de tokens conferidos: ${declaradas.length} operações com tarifa.`);
  }
}
