import { BadRequestException } from "@nestjs/common"

/**
 * Validator for campaign phase budgets
 * Ensures total budgets across all phases sum to exactly 100%
 */
export class PhaseBudgetValidator {
    private static readonly BUDGET_TOLERANCE = 0.01
    private static readonly MIN_BUDGET_PCT = 0
    private static readonly MAX_BUDGET_PCT = 100
    private static readonly REQUIRED_TOTAL = 100

    /**
     * Validate phase budget percentages
     * @param phases - Array of phases with budget percentages
     * @throws BadRequestException if validation fails
     */
    static validate(
        phases: Array<{
            phaseName: string
            ingredientBudgetPercentage: string | number
            cookingBudgetPercentage: string | number
            deliveryBudgetPercentage: string | number
        }>,
    ): void {
        if (!phases || phases.length === 0) {
            throw new BadRequestException(
                "At least one phase is required for budget validation",
            )
        }

        const budgetTotals = this.calculateBudgetTotals(phases)
        const grandTotal =
            budgetTotals.ingredient +
            budgetTotals.cooking +
            budgetTotals.delivery

        this.validateGrandTotal(grandTotal, budgetTotals)
    }

    /**
     * Calculate total budgets for each category
     */
    private static calculateBudgetTotals(
        phases: Array<{
            phaseName: string
            ingredientBudgetPercentage: string | number
            cookingBudgetPercentage: string | number
            deliveryBudgetPercentage: string | number
        }>,
    ): {
        ingredient: number
        cooking: number
        delivery: number
    } {
        let totalIngredient = 0
        let totalCooking = 0
        let totalDelivery = 0

        for (const [index, phase] of phases.entries()) {
            const budgets = this.parsePhaseBudgets(phase, index)

            this.validateBudgetRanges(phase.phaseName, index, budgets)

            totalIngredient += budgets.ingredient
            totalCooking += budgets.cooking
            totalDelivery += budgets.delivery
        }

        return {
            ingredient: totalIngredient,
            cooking: totalCooking,
            delivery: totalDelivery,
        }
    }

    /**
     * Parse budget percentages from string or number
     */
    private static parsePhaseBudgets(
        phase: {
            phaseName: string
            ingredientBudgetPercentage: string | number
            cookingBudgetPercentage: string | number
            deliveryBudgetPercentage: string | number
        },
        index: number,
    ): {
        ingredient: number
        cooking: number
        delivery: number
    } {
        const ingredientPct = Number.parseFloat(
            String(phase.ingredientBudgetPercentage),
        )
        const cookingPct = Number.parseFloat(
            String(phase.cookingBudgetPercentage),
        )
        const deliveryPct = Number.parseFloat(
            String(phase.deliveryBudgetPercentage),
        )

        if (
            Number.isNaN(ingredientPct) ||
            Number.isNaN(cookingPct) ||
            Number.isNaN(deliveryPct)
        ) {
            throw new BadRequestException(
                `Phase ${index + 1} (${phase.phaseName}): Budget percentages must be valid numbers`,
            )
        }

        return {
            ingredient: ingredientPct,
            cooking: cookingPct,
            delivery: deliveryPct,
        }
    }

    /**
     * Validate that each budget is within valid range (0-100%)
     */
    private static validateBudgetRanges(
        phaseName: string,
        index: number,
        budgets: {
            ingredient: number
            cooking: number
            delivery: number
        },
    ): void {
        const isInvalidRange = (value: number) =>
            value < this.MIN_BUDGET_PCT || value > this.MAX_BUDGET_PCT

        if (
            isInvalidRange(budgets.ingredient) ||
            isInvalidRange(budgets.cooking) ||
            isInvalidRange(budgets.delivery)
        ) {
            throw new BadRequestException(
                `Phase ${index + 1} (${phaseName}): Budget percentages must be between ${this.MIN_BUDGET_PCT} and ${this.MAX_BUDGET_PCT}`,
            )
        }
    }

    /**
     * Validate that grand total equals 100% (within tolerance)
     */
    private static validateGrandTotal(
        grandTotal: number,
        budgetTotals: {
            ingredient: number
            cooking: number
            delivery: number
        },
    ): void {
        const deviation = Math.abs(grandTotal - this.REQUIRED_TOTAL)

        if (deviation > this.BUDGET_TOLERANCE) {
            throw new BadRequestException(
                "Tổng budget của tất cả phases phải bằng 100%. " +
                    `Hiện tại: Ingredient (${budgetTotals.ingredient.toFixed(2)}%) + ` +
                    `Cooking (${budgetTotals.cooking.toFixed(2)}%) + ` +
                    `Delivery (${budgetTotals.delivery.toFixed(2)}%) = ${grandTotal.toFixed(2)}%`,
            )
        }
    }
}