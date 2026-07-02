import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndustrializedProduct } from './product.entity';
import { mapOpenFoodFactsProduct, MappedProduct } from './products-mapper';
import { RagService } from '../rag/rag.service';
import { buildProductChunkText } from '../rag/rag-chunk.util';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_FIELDS =
  'code,product_name,brands,ingredients_text,allergens_tags,additives_tags,nutriscore_grade,nova_group,countries,image_url,nutriments';
const OFF_UA = 'NutriPerformanceClinical/1.0 (apoio nutricional; contato via app)';

function toPublic(p: IndustrializedProduct) {
  return {
    id: p.id,
    codigoBarras: p.codigoBarras,
    marca: p.marca,
    nomeComercial: p.nomeComercial,
    ingredientes: p.ingredientes,
    alergenos: p.alergenos,
    tabelaNutricional: p.tabelaNutricional,
    aditivos: p.aditivos,
    nutriScore: p.nutriScore,
    novaClassificacao: p.novaClassificacao,
    pais: p.pais,
    imagemRotuloUrl: p.imagemRotuloUrl,
    alertaNutricional: p.alertaNutricional,
    // Proveniência sempre visível ao cliente
    fonte: p.fonte,
    confiabilidade: p.confiabilidade,
    licenca: p.licenca,
    dataAtualizacao: p.dataAtualizacao,
  };
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(IndustrializedProduct) private readonly repo: Repository<IndustrializedProduct>,
    private readonly ragService: RagService,
  ) {}

  /** Indexa o produto no RAG (não bloqueia o fluxo; falha de IA não derruba a consulta). */
  private indexInRag(p: IndustrializedProduct): void {
    const texto = buildProductChunkText({
      nomeComercial: p.nomeComercial, marca: p.marca, nutriScore: p.nutriScore,
      novaClassificacao: p.novaClassificacao, tabelaNutricional: p.tabelaNutricional,
      alertaNutricional: p.alertaNutricional, alergenos: p.alergenos,
    });
    this.ragService
      .indexChunk('openfoodfacts', p.codigoBarras, 'media', texto, { ean: p.codigoBarras })
      .catch((e) => this.logger.warn(`Falha ao indexar produto no RAG (${p.codigoBarras}): ${e?.message}`));
  }

  /** Busca por EAN: cache local primeiro; senão, Open Food Facts → persiste → retorna. */
  async findByBarcode(barcode: string) {
    const ean = (barcode ?? '').replace(/\D/g, '');
    if (ean.length < 8) throw new NotFoundException('Código de barras inválido');

    const cached = await this.repo.findOne({ where: { codigoBarras: ean } });
    if (cached) return { ...toPublic(cached), origem: 'cache' as const };

    const mapped = await this.fetchFromOpenFoodFacts(ean);
    if (!mapped) throw new NotFoundException('Produto não encontrado no Open Food Facts');

    const saved = await this.persist(mapped);
    this.indexInRag(saved); // auto-índice no RAG (fire-and-forget)
    return { ...toPublic(saved), origem: 'openfoodfacts' as const };
  }

  async search(query: string, limit = 20) {
    const q = (query ?? '').trim();
    if (q.length < 2) return [];
    const take = Math.min(50, Math.max(1, limit));
    // Nota: industrialized_products não possui coluna `ativo` (só `foods` tem esse
    // conceito de moderação hoje). Filtra apenas por confiabilidade, que é real.
    const rows = await this.repo
      .createQueryBuilder('p')
      .where("p.confiabilidade <> 'pendente'")
      .andWhere('(p.nome_comercial ILIKE :like OR p.marca ILIKE :like)', { like: `%${q}%` })
      .orderBy('p.nome_comercial', 'ASC')
      .take(take)
      .getMany();
    return rows.map(toPublic);
  }

  private async fetchFromOpenFoodFacts(ean: string): Promise<MappedProduct | null> {
    try {
      const url = `${OFF_BASE}/${ean}.json?fields=${OFF_FIELDS}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': OFF_UA },
      }).finally(() => clearTimeout(timer));
      if (!res.ok) return null;
      const data: any = await res.json();
      if (data?.status !== 1 || !data?.product) return null;
      return mapOpenFoodFactsProduct(ean, data.product);
    } catch (err: any) {
      this.logger.warn(`Falha ao consultar Open Food Facts (${ean}): ${err?.message}`);
      return null;
    }
  }

  private async persist(m: MappedProduct): Promise<IndustrializedProduct> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(IndustrializedProduct)
      .values({
        codigoBarras: m.codigo_barras,
        marca: m.marca,
        nomeComercial: m.nome_comercial,
        ingredientes: m.ingredientes,
        alergenos: m.alergenos,
        tabelaNutricional: m.tabela_nutricional,
        aditivos: m.aditivos,
        nutriScore: m.nutri_score,
        novaClassificacao: m.nova_classificacao,
        pais: m.pais,
        imagemRotuloUrl: m.imagem_rotulo_url,
        alertaNutricional: m.alerta_nutricional,
      })
      .orUpdate(
        ['marca', 'nome_comercial', 'ingredientes', 'alergenos', 'tabela_nutricional', 'aditivos',
         'nutri_score', 'nova_classificacao', 'pais', 'imagem_rotulo_url', 'alerta_nutricional', 'data_atualizacao'],
        ['codigo_barras'],
      )
      .execute();
    return this.repo.findOneOrFail({ where: { codigoBarras: m.codigo_barras } });
  }
}
