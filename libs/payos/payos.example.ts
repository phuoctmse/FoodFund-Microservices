// ==========================================
// CÁCH SỬ DỤNG PAYOS LIB
// ==========================================

/*
1. Import module vào app module:

```typescript
import { PayOSModule } from '@libs/payos'

@Module({
  imports: [
    PayOSModule.forRoot({
      clientId: process.env.PAYOS_CLIENT_ID,
      apiKey: process.env.PAYOS_API_KEY,
      checksumKey: process.env.PAYOS_CHECKSUM_KEY,
      environment: 'sandbox', // hoặc 'production'
    }),
  ],
})
export class AppModule {}
```

2. Inject service vào controller/service:

```typescript
import { PayOSService, PayOSWebhook, PayOSWebhookGuard } from '@libs/payos'

@Controller('payment')
export class PaymentController {
  constructor(private readonly payosService: PayOSService) {}

  // Tạo payment link
  @Post('create')
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    const paymentData = {
      orderCode: this.payosService.generateOrderCode(),
      amount: this.payosService.formatAmount(createPaymentDto.amount),
      description: createPaymentDto.description,
      items: createPaymentDto.items,
      returnUrl: 'https://yoursite.com/payment/success',
      cancelUrl: 'https://yoursite.com/payment/cancel',
      buyerName: createPaymentDto.buyerName,
      buyerEmail: createPaymentDto.buyerEmail,
      buyerPhone: createPaymentDto.buyerPhone,
    }

    return await this.payosService.createPaymentLink(paymentData)
  }

  // Kiểm tra trạng thái thanh toán
  @Get(':orderCode/status')
  async getPaymentStatus(@Param('orderCode') orderCode: number) {
    return await this.payosService.getPaymentLinkInformation(orderCode)
  }

  // Webhook endpoint để nhận thông báo từ PayOS
  @Post('webhook')
  @UseGuards(PayOSWebhookGuard) // Tự động verify signature
  async handleWebhook(@PayOSWebhook() webhookData: PayOSWebhookData) {
    console.log('Payment webhook received:', webhookData)
    
    // Xử lý logic business của bạn ở đây
    switch (webhookData.code) {
      case '00':
        // Thanh toán thành công
        console.log(`Payment successful for order: ${webhookData.orderCode}`)
        break
      case '01':
        // Thanh toán thất bại
        console.log(`Payment failed for order: ${webhookData.orderCode}`)
        break
      default:
        console.log(`Unknown payment status: ${webhookData.code}`)
    }

    return { success: true }
  }

  // Hủy payment link
  @Post(':orderCode/cancel')
  async cancelPayment(
    @Param('orderCode') orderCode: number,
    @Body('reason') reason?: string
  ) {
    return await this.payosService.cancelPaymentLink(orderCode, reason)
  }
}
```

3. DTO examples:

```typescript
export class CreatePaymentDto {
  @IsNumber()
  amount: number

  @IsString()
  description: string

  @IsOptional()
  @IsArray()
  items?: Array<{
    name: string
    quantity: number
    price: number
  }>

  @IsOptional()
  @IsString()
  buyerName?: string

  @IsOptional()
  @IsEmail()
  buyerEmail?: string

  @IsOptional()
  @IsString()
  buyerPhone?: string
}
```

4. Environment variables cần thiết:

```
PAYOS_CLIENT_ID=your_client_id
PAYOS_API_KEY=your_api_key  
PAYOS_CHECKSUM_KEY=your_checksum_key
```

5. Sử dụng trong service:

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly payosService: PayOSService) {}

  async processPayment(order: Order) {
    const paymentData = {
      orderCode: order.id,
      amount: order.totalAmount,
      description: `Payment for order #${order.id}`,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      buyerEmail: order.customerEmail,
    }

    try {
      const paymentLink = await this.payosService.createPaymentLink(paymentData)
      
      // Lưu payment link vào database
      await this.savePaymentLink(order.id, paymentLink)
      
      return paymentLink
    } catch (error) {
      console.error('Payment creation failed:', error)
      throw error
    }
  }

  async checkPaymentStatus(orderCode: number) {
    return await this.payosService.checkTransactionStatus(orderCode)
  }
}
```
*/