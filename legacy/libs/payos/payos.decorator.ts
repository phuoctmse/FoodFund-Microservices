import {
    createParamDecorator,
    ExecutionContext,
    BadRequestException,
} from "@nestjs/common"
import { PayOSWebhookData } from "./payos.types"

export const PayOSWebhook = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): PayOSWebhookData => {
        const request = ctx.switchToHttp().getRequest()
        const webhookData = request.body

        // Validate required fields
        if (!webhookData.orderCode) {
            throw new BadRequestException("Missing orderCode in webhook data")
        }

        if (!webhookData.amount) {
            throw new BadRequestException("Missing amount in webhook data")
        }

        if (!webhookData.description) {
            throw new BadRequestException("Missing description in webhook data")
        }

        return webhookData
    },
)
