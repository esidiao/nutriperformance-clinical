import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Food } from './food.entity';
import { mapUsdaFood } from './usda-mapper';
import { RagService } from '../rag/rag.service';
import { buildFoodChunkText } from '../rag/rag-chunk.util';

const USDA_SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// ─── Busca por termos ────────────────────────────────────────────────────────
//
// Os nomes da TACO são invertidos e separados por vírgula ("Feijão, carioca,
// cozido"). Uma busca por `ILIKE '%frase inteira%'` exige a frase contígua e
// por isso não encontra "feijão carioca" — o alimento existe e fica
// inalcançável. Medido em 20 consultas escritas como a profissional digita:
// nenhuma retornava resultado.
//
// A correção é exigir todos os termos, em qualquer ordem e posição.
//
// Acentos entram no mesmo problema: quem digita "feijao" não acha "Feijão".
// Resolvido sem depender da extensão `unaccent` (ausente neste banco): o termo
// é normalizado e cada vogal vira uma classe com suas variantes acentuadas.
// O trema entra porque a TACO foi gravada na ortografia anterior ao Acordo de
// 1990: a base diz "Lingüiça", e ninguém digita assim hoje.
const VARIANTES: Record<string, string> = {
  a: 'aáàâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç', n: 'nñ',
};

// Particípios de preparo aparecem nos dois gêneros conforme o alimento
// ("acém, moído" x "carne moída"). Quem digita não sabe qual a tabela usou, e
// exigir o gênero certo derrubava a busca. A lista é fechada de propósito: só
// termos de preparo, para não confundir palavras onde o gênero muda o
// significado.
const PARTICIPIOS = new Set([
  'cru', 'crua', 'cozido', 'cozida', 'assado', 'assada', 'frito', 'frita',
  'grelhado', 'grelhada', 'refogado', 'refogada', 'moido', 'moida',
  'torrado', 'torrada', 'salgado', 'salgada', 'congelado', 'congelada',
  'enlatado', 'enlatada', 'desnatado', 'desnatada', 'defumado', 'defumada',
  'temperado', 'temperada', 'recheado', 'recheada', 'empanado', 'empanada',
]);

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const escapar = (s: string) =>
  s
    .split('')
    .map((ch) => {
      const classe = VARIANTES[ch];
      if (classe) return `[${classe}]`;
      // Só letras e dígitos passam crus; qualquer outro caractere é escapado,
      // para que um `%` ou `(` digitado não vire metacaractere de regex.
      return /[a-z0-9]/.test(ch) ? ch : `\\${ch}`;
    })
    .join('');

/** Converte um termo em regex que casa com e sem acento. Escapa o resto. */
export function termoParaRegex(termo: string): string {
  const base = semAcento(termo).toLowerCase();

  // "cru" e "crua" não trocam a vogal final: uma acrescenta letra à outra.
  if (base === 'cru' || base === 'crua') return `${escapar('cru')}a?`;

  // Demais particípios de preparo: a vogal final aceita os dois gêneros, para
  // que "moída" encontre "moído" e vice-versa.
  if (PARTICIPIOS.has(base) && /[oa]$/.test(base)) {
    return `${escapar(base.slice(0, -1))}[oa]`;
  }

  return escapar(base);
}

// Conectores que a profissional digita mas a TACO não usa: ela grava
// "Frango, peito, sem pele, cru", sem o "de" de "peito de frango". Exigir
// esses termos derrubava a busca inteira por uma palavra que não carrega
// significado nenhum.
const CONECTORES = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'ao', 'aos', 'com', 'sem', 'para', 'por', 'ou',
]);

/** Termos úteis da consulta: sem conectores, sem monossílabos, no máximo 6. */
export function extrairTermos(query: string): string[] {
  const termos = query
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => semAcento(t).length >= 2)
    .filter((t) => !CONECTORES.has(semAcento(t).toLowerCase()));

  // Se a consulta era só conectores ("com", "de"), devolver vazio deixaria a
  // busca muda; melhor tentar com o que foi digitado.
  if (termos.length === 0) {
    return query.trim().split(/\s+/).filter((t) => semAcento(t).length >= 2).slice(0, 6);
  }
  return termos.slice(0, 6);
}

// DTO público — expõe apenas o necessário ao cliente, sempre com proveniência.
function toPublic(f: Food) {
  return {
    id: f.id,
    nome: f.nomePadronizado,
    nomesPopulares: f.nomesPopulares,
    grupoAlimentar: f.grupoAlimentar,
    novaClassificacao: f.novaClassificacao,
    porcaoPadraoG: Number(f.porcaoPadraoG),
    energiaKcal: f.energiaKcal != null ? Number(f.energiaKcal) : null,
    carboidratosG: f.carboidratosG != null ? Number(f.carboidratosG) : null,
    proteinasG: f.proteinasG != null ? Number(f.proteinasG) : null,
    lipidiosG: f.lipidiosG != null ? Number(f.lipidiosG) : null,
    gorduraSaturadaG: f.gorduraSaturadaG != null ? Number(f.gorduraSaturadaG) : null,
    gorduraTransG: f.gorduraTransG != null ? Number(f.gorduraTransG) : null,
    fibrasG: f.fibrasG != null ? Number(f.fibrasG) : null,
    sodioMg: f.sodioMg != null ? Number(f.sodioMg) : null,
    acucaresG: f.acucaresG != null ? Number(f.acucaresG) : null,
    calcioMg: f.calcioMg != null ? Number(f.calcioMg) : null,
    ferroMg: f.ferroMg != null ? Number(f.ferroMg) : null,
    potassioMg: f.potassioMg != null ? Number(f.potassioMg) : null,
    magnesioMg: f.magnesioMg != null ? Number(f.magnesioMg) : null,
    zincoMg: f.zincoMg != null ? Number(f.zincoMg) : null,
    indiceGlicemico: f.indiceGlicemico != null ? Number(f.indiceGlicemico) : null,
    alergenos: f.alergenos,
    vitaminas: f.vitaminas,
    observacoesClinicas: f.observacoesClinicas,
    // Proveniência sempre presente (modelo da evidence_base)
    fonte: f.fonte,
    fonteVersao: f.fonteVersao,
    confiabilidade: f.confiabilidade,
  };
}

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name);

  constructor(
    @InjectRepository(Food) private readonly repo: Repository<Food>,
    private readonly config: ConfigService,
    private readonly ragService: RagService,
  ) {}

  /**
   * Importa sob demanda alimentos do USDA FoodData Central (domínio público).
   * Usa USDA_API_KEY do ambiente ou DEMO_KEY (baixo volume). Cacheia em `foods`
   * (fonte='usda') — passam a aparecer no autocomplete/comparador — e indexa no RAG.
   */
  async searchUsda(query: string, limit = 10) {
    const q = (query ?? '').trim();
    if (q.length < 2) return [];
    const key = this.config.get<string>('USDA_API_KEY') || 'DEMO_KEY';
    const size = Math.min(20, Math.max(1, limit));

    let foods: any[] = [];
    try {
      const url = `${USDA_SEARCH}?api_key=${key}&query=${encodeURIComponent(q)}&pageSize=${size}&dataType=${encodeURIComponent('SR Legacy,Foundation')}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) { this.logger.warn(`USDA HTTP ${res.status}`); return []; }
      const data: any = await res.json();
      foods = Array.isArray(data?.foods) ? data.foods : [];
    } catch (err: any) {
      this.logger.warn(`Falha ao consultar USDA: ${err?.message}`);
      return [];
    }

    const mapped = foods.map(mapUsdaFood).filter((m) => m.nome_padronizado && m.fonte_id_externo);
    const savedIds: string[] = [];
    for (const m of mapped) {
      await this.repo.upsert(
        {
          nomePadronizado: m.nome_padronizado, grupoAlimentar: m.grupo_alimentar,
          energiaKcal: m.energia_kcal as any, proteinasG: m.proteinas_g as any, carboidratosG: m.carboidratos_g as any,
          lipidiosG: m.lipidios_g as any, gorduraSaturadaG: m.gordura_saturada_g as any, fibrasG: m.fibras_g as any,
          acucaresG: m.acucares_g as any, sodioMg: m.sodio_mg as any, calcioMg: m.calcio_mg as any, ferroMg: m.ferro_mg as any,
          potassioMg: m.potassio_mg as any, magnesioMg: m.magnesio_mg as any, zincoMg: m.zinco_mg as any,
          vitaminas: m.vitaminas, fonte: 'usda', fonteIdExterno: m.fonte_id_externo,
          fonteVersao: 'FoodData Central', confiabilidade: 'alta', licenca: 'Domínio público (USDA, CC0)',
        } as any,
        { conflictPaths: ['fonte', 'fonteIdExterno'] },
      );
      savedIds.push(m.fonte_id_externo!);
    }

    const rows = await this.repo.find({ where: { fonte: 'usda', fonteIdExterno: In(savedIds) } });
    // Indexa no RAG (fire-and-forget) — não bloqueia a resposta
    for (const f of rows) {
      this.ragService
        .indexChunk('usda', f.id, 'alta', buildFoodChunkText(f as any), { nome: f.nomePadronizado })
        .catch((e: any) => this.logger.warn(`Falha ao indexar alimento USDA no RAG (${f.id}): ${e?.message}`));
    }
    return rows.map(toPublic);
  }

  /**
   * Busca por nome padronizado ou nomes populares.
   * Bloqueio clínico: itens 'pendente' ou inativos NÃO entram na busca (uso clínico
   * exige fonte confiável). Curadoria libera ao promover confiabilidade.
   */
  async search(query: string, limit = 20) {
    const q = (query ?? '').trim();
    if (q.length < 2) return [];

    const termos = extrairTermos(q);
    if (termos.length === 0) return [];

    const take = Math.min(50, Math.max(1, limit));
    const qb = this.repo
      .createQueryBuilder('f')
      .where('f.ativo = true')
      .andWhere("f.confiabilidade <> 'pendente'");

    // Todos os termos precisam aparecer — no nome padronizado OU entre os nomes
    // populares. Assim "feijão carioca" encontra "Feijão, carioca, cozido", e
    // "carioca feijão" também.
    termos.forEach((termo, i) => {
      const p = `t${i}`;
      qb.andWhere(
        `(f.nome_padronizado ~* :${p}
          OR EXISTS (SELECT 1 FROM unnest(f.nomes_populares) np WHERE np ~* :${p}))`,
        { [p]: termoParaRegex(termo) },
      );
    });

    const rows = await qb
      // Quem começa pelo primeiro termo digitado vem antes: buscando "arroz",
      // "Arroz, integral" deve preceder "Baião de dois, arroz e feijão".
      .orderBy(`CASE WHEN f.nome_padronizado ~* :inicio THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('LENGTH(f.nome_padronizado)', 'ASC')
      .addOrderBy('f.nome_padronizado', 'ASC')
      .setParameter('inicio', `^${termoParaRegex(termos[0])}`)
      .take(take)
      .getMany();

    return rows.map(toPublic);
  }

  async findById(id: string) {
    const food = await this.repo.findOne({ where: { id, ativo: true } });
    if (!food) throw new NotFoundException('Alimento não encontrado');
    if (food.confiabilidade === 'pendente') throw new NotFoundException('Alimento não disponível');
    return toPublic(food);
  }

  /** Comparação lado a lado de 2 a 4 alimentos (valores por porção padrão / 100g). */
  async compare(ids: string[]) {
    const clean = (ids ?? []).filter(Boolean).slice(0, 4);
    if (clean.length < 2) return [];
    // Bloqueio clínico: itens 'pendente' (curadoria) não entram na comparação.
    const rows = (await this.repo.find({ where: { id: In(clean) } }))
      .filter((r) => r.confiabilidade !== 'pendente' && r.ativo !== false);
    // preserva a ordem solicitada
    const byId = new Map(rows.map((r) => [r.id, r]));
    return clean.map((id) => byId.get(id)).filter(Boolean).map((f) => toPublic(f!));
  }
}
