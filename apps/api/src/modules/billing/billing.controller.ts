import {
  Controller, Post, Body, Req, Headers, HttpCode, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicalStaff, Public } from '../../common/decorators';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ClinicalStaff()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar preferência de pagamento Mercado Pago' })
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

  @Post('webhook')
  @Public()
  @HttpCode(200)
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
