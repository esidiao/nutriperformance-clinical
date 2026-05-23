import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { TokenService } from '../tokens/token.service';

@Injectable()
export class BillingService {
  private stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private config: ConfigService,
    private tokenService: TokenService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-04-10',
    });
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
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: params.isSubscription ? 'subscription' : 'payment',
      line_items: [
        {
          price_data: {
            currency: 'brl',
            unit_amount: Math.round(params.priceBrl * 100), // centavos
            product_data: {
              name: `NutriPerformance Clinical — ${params.tokens} tokens`,
              description: params.isSubscription
                ? `Assinatura mensal — ${params.tokens} tokens/mês`
                : `Pacote de ${params.tokens} tokens`,
            },
            ...(params.isSubscription
              ? { recurring: { interval: 'month' } }
              : {}),
          },
          quantity: 1,
        },
      ],
      metadata: {
        workspaceId: params.workspaceId,
        packageId: params.packageId,
        tokens: String(params.tokens),
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return { url: session.url, sessionId: session.id };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')!;

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.error(`Webhook inválido: ${err}`);
      throw new Error('Webhook inválido');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.processSuccessfulPayment(session);
        break;
      }
      case 'invoice.payment_succeeded': {
        // Renovação de assinatura → créditar tokens mensais
        const invoice = event.data.object as Stripe.Invoice;
        await this.processSubscriptionRenewal(invoice);
        break;
      }
      case 'customer.subscription.deleted': {
        // Cancelamento → não renovar tokens
        this.logger.log(`Assinatura cancelada: ${event.data.object}`);
        break;
      }
    }
  }

  private async processSuccessfulPayment(session: Stripe.Checkout.Session) {
    const { workspaceId, tokens, packageId } = session.metadata!;

    await this.tokenService.credit({
      workspaceId,
      operation: 'purchase',
      amount: Number(tokens),
      description: `Pagamento confirmado — ${tokens} tokens`,
      paymentId: session.payment_intent as string,
    });

    this.logger.log(`Tokens creditados: ${tokens} para workspace ${workspaceId}`);
  }

  private async processSubscriptionRenewal(invoice: Stripe.Invoice) {
    const subscription = await this.stripe.subscriptions.retrieve(
      invoice.subscription as string,
    );
    const workspaceId = subscription.metadata?.workspaceId;
    const tokens = subscription.metadata?.tokensPerPeriod;

    if (!workspaceId || !tokens) {
      this.logger.warn(`Metadados de assinatura ausentes: ${invoice.id}`);
      return;
    }

    await this.tokenService.credit({
      workspaceId,
      operation: 'purchase',
      amount: Number(tokens),
      description: `Renovação mensal — ${tokens} tokens`,
      paymentId: invoice.payment_intent as string,
    });
  }
}
