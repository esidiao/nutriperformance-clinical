import {
  Controller, Post, Body, Req, Headers, RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar sessão de checkout Stripe' })
  async createCheckout(@Body() body: any, @Req() req: any) {
    return this.billingService.createCheckoutSession({
      workspaceId: req.user.workspaceId,
      packageId: body.packageId,
      tokens: body.tokens,
      priceBrl: body.priceBrl,
      isSubscription: body.isSubscription ?? false,
      successUrl: `${process.env.FRONTEND_URL}/tokens?success=1`,
      cancelUrl: `${process.env.FRONTEND_URL}/tokens?cancelled=1`,
    });
  }

  @Post('stripe/webhook')
  @ApiOperation({ summary: 'Webhook Stripe — validado por assinatura' })
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.billingService.handleStripeWebhook(req.rawBody!, signature);
    return { received: true };
  }
}
