import { NotificationType } from "@app/campaign/src/domain/enums/notification"
import { NotificationDataMap } from "./notification-data.interface"

export interface NotificationBuilderContext<
    T extends NotificationType & keyof NotificationDataMap,
> {
    type: T
    data: NotificationDataMap[T]
    userId: string
    actorId?: string
    entityId?: string
    metadata?: Record<string, any>
}

export interface NotificationBuilderResult {
    title: string
    message: string
    metadata?: Record<string, any>
}

export abstract class NotificationBuilder<
    T extends NotificationType & keyof NotificationDataMap,
> {
    abstract readonly type: T

    abstract build(
        context: NotificationBuilderContext<T>,
    ): NotificationBuilderResult

    protected validate(data: NotificationDataMap[T]): void {
        if (!data) {
            throw new Error(`Notification data is required for type: ${this.type}`)
        }
    }

    protected truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text
        }
        return `${text.substring(0, maxLength - 3)}...`
    }

    protected formatNumber(num: number): string {
        return num.toLocaleString("en-US")
    }

    protected formatCurrency(amount: string | number): string {
        const numAmount = typeof amount === "string" ? Number.parseFloat(amount) : amount
        return `${this.formatNumber(numAmount)} VND`
    }
}