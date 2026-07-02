import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createHmac } from 'crypto';
import { TokenService } from '../tokens/token.service';

@Injectable()
export class BillingService {
  private mp: MercadoPagoConfig;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private config: ConfigService,
    private tokenService: TokenService,
  ) {
    const accessToken = this.config.get<string>('MP_ACCESS_TOKEN') ?? '';
    this.mp = new MercadoPagoConfig({ accessToken });
  }

  async createCheckoutSession(params: {
    workspaceId: string;
    packageId: string;
    tokens: number;
    priceBrl: number;
    isSubscription: boolean;
    successUrl: string;
    cancelUrl: string;
  }) {
    const apiUrl =
      this.config.get<string>('API_URL') ??
      `https://${this.config.get<string>('RAILWAY_STATIC_URL') ?? 'localhost:3001'}`;

    const preference = new Preference(this.mp);
    const result = await preference.create({
      body: {
        items: [
          {
            id: params.packageId,
            title: `NutriPerformance Clinical — ${params.tokens} tokens`,
            description: params.isSubscription
              ? `Assinatura mensal — ${params.tokens} tokens/mês`
              : `Pacote de ${params.tokens} tokens`,
            quantity: 1,
            unit_price: params.priceBrl,
            currency_id: 'BRL',
          },
        ],
        metadata: {
          workspace_id: params.workspaceId,
          package_id: params.packageId,
          tokens: String(params.tokens),
          is_subscription: params.isSubscription,
        },
        back_urls: {
          success: params.successUrl,
          failure: params.cancelUrl,
          pending: params.successUrl,
        },
        auto_return: 'approved',
        notification_url: `${apiUrl}/billing/webhook`,
      },
    });

    return { url: result.init_point, preferenceId: result.id };
  }

  async handleWebhook(
    body: any,
    xSignature: string | undefined,
    xRequestId: string | undefined,
  ): Promise<void> {
    const webhookSecret = this.config.get<string>('MP_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('MP_WEBHOOK_SECRET não configurado — webhook rejeitado por segurança');
      throw new Error('Configuração de webhook ausente');
    }

    if (!xSignature || !xRequestId) {
      this.logger.warn(`Webhook sem assinatura rejeitado (ip omitido por privacidade)`);
      throw new Error('Assinatura obrigatória');
    }

    const tsMatch = xSignature.match(/ts=([^,]+)/);
    const v1Match = xSignature.match(/v1=([^,]+)/);
    const ts = tsMatch?.[1];
    const v1 = v1Match?.[1];
    const dataId = body?.data?.id ?? '';

    if (!ts || !v1) {
      throw new Error('Assinatura malformada');
    }

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = createHmac('sha256', webhookSecret).update(manifest).digest('hex');

    if (v1 !== expected) {
      this.logger.error(`Assinatura Mercado Pago inválida para request-id=${xRequestId}`);
      throw new Error('Webhook inválido');
    }

    const { type, action, data } = body;
    const eventType = type ?? action;

    this.logger.log(`Webhook MP recebido: ${eventType} | id=${data?.id}`);

    if (eventType === 'payment' || eventType === 'payment.updated') {
      const paymentId = data?.id;
      if (!paymentId) return;

      const paymentClient = new Payment(this.mp);
      const payment = await paymentClient.get({ id: String(paymentId) });

      if (payment.status === 'approved') {
        await this.processApprovedPayment(payment);
      } else {
        this.logger.log(`Pagamento ${paymentId} status: ${payment.status}`);
      }
    }
  }

  private async processApprovedPayment(payment: any): Promise<void> {
    const meta = payment.metadata;

    if (!meta?.workspace_id || !meta?.tokens) {
      this.logger.warn(
        `Metadados ausentes no pagamento ${payment.id}. Meta: ${JSON.stringify(meta)}`,
      );
      return;
    }

    await this.tokenService.credit({
      workspaceId: meta.workspace_id,
      operation: 'purchase',
      amount: Number(meta.tokens),
      description: `Pagamento Mercado Pago confirmado — ${meta.tokens} tokens`,
      paymentId: String(payment.id),
    });

    this.logger.log(
      `✓ Tokens creditados: ${meta.tokens} para workspace ${meta.workspace_id} (MP #${payment.id})`,
    );
  }
}
