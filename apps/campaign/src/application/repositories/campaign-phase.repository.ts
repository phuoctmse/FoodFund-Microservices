import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/campaign-client"
import { CampaignPhaseStatus } from "../../domain/enums/campaign-phase/campaign-phase.enum"
import { minBigInt } from "../../shared/utils"

export interface CreatePhaseData {
    campaignId: string
    phaseName: string
    location: string
    ingredientPurchaseDate: Date
    cookingDate: Date
    deliveryDate: Date
    ingredientBudgetPercentage: number
    cookingBudgetPercentage: number
    deliveryBudgetPercentage: number
    status?: CampaignPhaseStatus
}

export interface UpdatePhaseData {
    phaseName?: string
    location?: string
    ingredientPurchaseDate?: Date
    cookingDate?: Date
    deliveryDate?: Date
    ingredientBudgetPercentage?: number
    cookingBudgetPercentage?: number
    deliveryBudgetPercentage?: number
    status?: CampaignPhaseStatus
}

export interface SyncPhasesData {
    campaignId: string
    phases: Array<{
        id?: string
        phaseName: string
        location: string
        ingredientPurchaseDate: Date
        cookingDate: Date
        deliveryDate: Date
        ingredientBudgetPercentage: number
        cookingBudgetPercentage: number
        deliveryBudgetPercentage: number
    }>
}

@Injectable()
export class CampaignPhaseRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async getCampaignIdByPhaseId(phaseId: string): Promise<string | null> {
        const phase = await this.prisma.campaign_Phase.findUnique({
            where: {
                id: phaseId,
                is_active: true,
            },
            select: {
                campaign_id: true,
            },
        })

        return phase?.campaign_id || null
    }

    async findByCampaignId(campaignId: string) {
        const phases = await this.prisma.campaign_Phase.findMany({
            where: {
                campaign_id: campaignId,
                is_active: true,
            },
            orderBy: { created_at: "asc" },
            include: {
                campaign: {
                    select: {
                        received_amount: true,
                        target_amount: true,
                    },
                },
            },
        })

        return phases.map((phase) =>
            this.mapToGraphQLModelWithFunds(
                phase,
                phase.campaign?.received_amount || BigInt(0),
                phase.campaign?.target_amount || BigInt(0),
            ),
        )
    }

    async getPhaseStatus(id: string): Promise<CampaignPhaseStatus | null> {
        const phase = await this.prisma.campaign_Phase.findUnique({
            where: { id, is_active: true },
            select: { status: true },
        })

        return phase ? (phase.status as CampaignPhaseStatus) : null
    }

    async findByIdWithCampaign(id: string) {
        const phase = await this.prisma.campaign_Phase.findUnique({
            where: { id, is_active: true },
            include: {
                campaign: {
                    select: {
                        id: true,
                        received_amount: true,
                        target_amount: true,
                    },
                },
            },
        })

        if (!phase) return null

        return this.mapToGraphQLModelWithFunds(
            phase,
            phase.campaign.received_amount,
            phase.campaign?.target_amount || BigInt(0),
        )
    }

    async updateStatus(id: string, status: CampaignPhaseStatus): Promise<void> {
        await this.prisma.campaign_Phase.update({
            where: { id, is_active: true },
            data: {
                status,
                updated_at: new Date(),
            },
        })
    }

    async syncPhases(data: SyncPhasesData): Promise<{
        phases: any[]
        createdCount: number
        updatedCount: number
        deletedCount: number
    }> {
        return await this.prisma.$transaction(async (tx) => {
            const existingPhases = await tx.campaign_Phase.findMany({
                where: {
                    campaign_id: data.campaignId,
                    is_active: true,
                },
            })

            const existingIds = new Set(existingPhases.map((p) => p.id))
            const incomingIds = new Set(
                data.phases.filter((p) => p.id).map((p) => p.id!),
            )

            const toCreate = data.phases.filter((p) => !p.id)
            const toUpdate = data.phases.filter(
                (p) => p.id && existingIds.has(p.id),
            )
            const toDeleteIds = [...existingIds].filter(
                (id) => !incomingIds.has(id),
            )

            const createdPhases = await Promise.all(
                toCreate.map((phase) =>
                    tx.campaign_Phase.create({
                        data: {
                            campaign_id: data.campaignId,
                            phase_name: phase.phaseName,
                            location: phase.location,
                            ingredient_purchase_date:
                                phase.ingredientPurchaseDate,
                            cooking_date: phase.cookingDate,
                            delivery_date: phase.deliveryDate,
                            ingredient_budget_percentage:
                                phase.ingredientBudgetPercentage,
                            cooking_budget_percentage:
                                phase.cookingBudgetPercentage,
                            delivery_budget_percentage:
                                phase.deliveryBudgetPercentage,
                            status: CampaignPhaseStatus.PLANNING,
                            is_active: true,
                        },
                    }),
                ),
            )

            const updatedPhases = await Promise.all(
                toUpdate.map((phase) =>
                    tx.campaign_Phase.update({
                        where: { id: phase.id, is_active: true },
                        data: {
                            phase_name: phase.phaseName,
                            location: phase.location,
                            ingredient_purchase_date:
                                phase.ingredientPurchaseDate,
                            cooking_date: phase.cookingDate,
                            delivery_date: phase.deliveryDate,
                            ingredient_budget_percentage:
                                phase.ingredientBudgetPercentage,
                            cooking_budget_percentage:
                                phase.cookingBudgetPercentage,
                            delivery_budget_percentage:
                                phase.deliveryBudgetPercentage,
                            updated_at: new Date(),
                        },
                    }),
                ),
            )

            let deletedCount = 0
            if (toDeleteIds.length > 0) {
                const deleteResult = await tx.campaign_Phase.updateMany({
                    where: {
                        id: { in: toDeleteIds },
                        is_active: true,
                    },
                    data: {
                        is_active: false,
                        updated_at: new Date(),
                    },
                })
                deletedCount = deleteResult.count
            }

            const allPhases = [...createdPhases, ...updatedPhases]

            return {
                phases: allPhases,
                createdCount: createdPhases.length,
                updatedCount: updatedPhases.length,
                deletedCount,
            }
        })
    }

    private mapToGraphQLModelWithFunds(
        dbPhase: any,
        campaignReceivedAmount: bigint,
        campaignTargetAmount?: bigint,
    ) {
        const ingredientPct =
            Number.parseFloat(
                dbPhase.ingredient_budget_percentage?.toString() || "0",
            ) / 100
        const cookingPct =
            Number.parseFloat(
                dbPhase.cooking_budget_percentage?.toString() || "0",
            ) / 100
        const deliveryPct =
            Number.parseFloat(
                dbPhase.delivery_budget_percentage?.toString() || "0",
            ) / 100

        let fundableAmount = BigInt(campaignReceivedAmount || 0)
        if (campaignTargetAmount !== undefined) {
            fundableAmount = minBigInt(fundableAmount, campaignTargetAmount)
        }

        const ingredientFunds =
            fundableAmount > 0n
                ? (fundableAmount * BigInt(Math.floor(ingredientPct * 10000))) /
                  10000n
                : 0n
        const cookingFunds =
            fundableAmount > 0n
                ? (fundableAmount * BigInt(Math.floor(cookingPct * 10000))) /
                  10000n
                : 0n
        const deliveryFunds =
            fundableAmount > 0n
                ? (fundableAmount * BigInt(Math.floor(deliveryPct * 10000))) /
                  10000n
                : 0n

        return {
            id: dbPhase.id,
            campaignId: dbPhase.campaign_id,
            phaseName: dbPhase.phase_name,
            location: dbPhase.location,
            ingredientPurchaseDate: dbPhase.ingredient_purchase_date,
            cookingDate: dbPhase.cooking_date,
            deliveryDate: dbPhase.delivery_date,
            ingredientBudgetPercentage:
                dbPhase.ingredient_budget_percentage?.toString() ?? "0",
            cookingBudgetPercentage:
                dbPhase.cooking_budget_percentage?.toString() ?? "0",
            deliveryBudgetPercentage:
                dbPhase.delivery_budget_percentage?.toString() ?? "0",
            ingredientFundsAmount:
                ingredientFunds > 0n ? ingredientFunds.toString() : undefined,
            cookingFundsAmount:
                cookingFunds > 0n ? cookingFunds.toString() : undefined,
            deliveryFundsAmount:
                deliveryFunds > 0n ? deliveryFunds.toString() : undefined,
            status: dbPhase.status as CampaignPhaseStatus,
            created_at: dbPhase.created_at,
            updated_at: dbPhase.updated_at,
        }
    }

    private mapToGraphQLModel(dbPhase: any) {
        return this.mapToGraphQLModelWithFunds(dbPhase, BigInt(0))
    }
}
