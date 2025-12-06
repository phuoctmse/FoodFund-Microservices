import { BadRequestException } from "@nestjs/common"

export class BudgetValidationHelper {
    static validateItemsTotalCost(
        items: Array<{ estimatedTotalPrice: number; ingredientName: string }>,
        requestTotalCost: string,
    ): void {
        const itemsTotal = items.reduce(
            (sum, item) => sum + item.estimatedTotalPrice,
            0,
        )

        const requestTotal = parseFloat(requestTotalCost)

        if (isNaN(requestTotal)) {
            throw new BadRequestException(
                "Invalid total cost format. Must be a valid number.",
            )
        }

        const difference = Math.abs(itemsTotal - requestTotal)
        const tolerance = 0.01

        if (difference > tolerance) {
            const itemsTotalFormatted = this.formatCurrency(
                BigInt(Math.round(itemsTotal)),
            )
            const requestTotalFormatted = this.formatCurrency(
                BigInt(Math.round(requestTotal)),
            )

            throw new BadRequestException(
                `Total item cost (${itemsTotalFormatted} VND) does not match ` +
                    `request total cost (${requestTotalFormatted} VND). ` +
                    `Difference: ${Math.round(difference)} VND. ` +
                    "Please check the estimatedTotalPrice of each item.",
            )
        }
    }

    private static formatCurrency(amount: bigint): string {
        return Number(amount).toLocaleString("vi-VN")
    }

    static validateItemPrices(
        items: Array<{
            estimatedUnitPrice: number
            estimatedTotalPrice: number
        }>,
    ): void {
        for (const item of items) {
            if (
                item.estimatedUnitPrice <= 0 ||
                item.estimatedTotalPrice <= 0
            ) {
                throw new BadRequestException(
                    "All item prices must be greater than 0",
                )
            }
        }
    }

    static validateFileTypes(
        fileTypes: string[],
        allowedTypes: string[] = ["jpg", "jpeg", "png", "mp4", "mov"],
    ): void {
        const invalidTypes = fileTypes.filter(
            (type) => !allowedTypes.includes(type.toLowerCase()),
        )

        if (invalidTypes.length > 0) {
            throw new BadRequestException(
                `Invalid file types: ${invalidTypes.join(", ")}. ` +
                    `Allowed: ${allowedTypes.join(", ")}`,
            )
        }
    }
}