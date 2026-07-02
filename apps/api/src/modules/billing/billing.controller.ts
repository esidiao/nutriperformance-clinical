import {
  Controller, Post, Body, Req, Headers, HttpCode, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicalStaff, Public } from '../../common/decorators';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ClinicalStaff()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar preferência de pagamento Mercado Pago' })
  async createCheckout(@Body() dto: CreateCheckoutDto, @Req() req: any) {
    return this.billingService.createCheckoutSession({
      workspaceId: req.user.workspaceId,
      packageId: dto.packageId,
      tokens: dto.tokens,
      priceBrl: dto.priceBrl,
      isSubscription: dto.isSubscription ?? false,
      successUrl: `${process.env.FRONTEND_URL}/tokens?success=1`,
      cancelUrl: `${process.env.FRONTEND_URL}/tokens?cancelled=1`,
    });
  }

  @Post('webhook')
  @Public()
  @HttpCode(200)
  // Limite específico: webhook público — protege contra flood mesmo com assinatura.
  // Generoso o bastante para retries legítimos do Mercado Pago.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Webhook Mercado Pago — notificações de pagamento' })
  async mpWebhook(
    @Body() body: any,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
  ) {
    await this.billingService.handleWebhook(body, xSignature, xRequestId);
    return { received: true };
  }
}
