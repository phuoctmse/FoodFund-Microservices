import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    Inject,
} from "@nestjs/common"
import { PayOSService } from "./payos.service"

@Injectable()
export class PayOSWebhookGuard implements CanActivate {
    constructor(private readonly payosService: PayOSService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest()
        const signature = request.headers["x-payos-signature"]
        const webhookData = request.body

        if (!signature) {
            throw new UnauthorizedException("Missing PayOS webhook signature")
        }

        try {
            // Verify webhook signature
            this.payosService.verifyPaymentWebhookData(webhookData)
            return true
        } catch (error) {
            throw new UnauthorizedException("Invalid PayOS webhook signature")
        }
    }
}