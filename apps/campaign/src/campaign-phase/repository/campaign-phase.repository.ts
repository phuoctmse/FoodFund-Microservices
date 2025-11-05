import { Injectable } from "@nestjs/common"
import { CampaignPhaseStatus } from "../enum"
import { PrismaClient } from "../../generated/campaign-client"
import { SentryService } from "@libs/observability"

export interface CreatePhaseData {
    campaignId: string
    phaseName: string
    location: string
    ingredientPurchaseDate: Date
    cookingDate: Date
    deliveryDate: Date
    status?: CampaignPhaseStatus
}

export interface UpdatePhaseData {
    phaseName?: string
    location?: string
    ingredientPurchaseDate?: Date
    cookingDate?: Date
    deliveryDate?: Date
    status?: CampaignPhaseStatus
}

@Injectable()
export class CampaignPhaseRepository {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly sentryService: SentryService,
    ) {}

    async create(data: CreatePhaseData) {
        try {
            const phase = await this.prisma.campaign_Phase.create({
                data: {
                    campaign_id: data.campaignId,
                    phase_name: data.phaseName,
                    location: data.location,
                    ingredient_purchase_date: data.ingredientPurchaseDate,
                    cooking_date: data.cookingDate,
                    delivery_date: data.deliveryDate,
                    status: CampaignPhaseStatus.PLANNING,
                    is_active: true,
                },
            })

            return this.mapToGraphQLModel(phase)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createCampaignPhase",
                campaignId: data.campaignId,
                phaseName: data.phaseName,
            })
            throw error
        }
    }

    async createMany(campaignId: string, phases: CreatePhaseData[]) {
        try {
            const createdPhases = await this.prisma.$transaction(
                phases.map((phase) =>
                    this.prisma.campaign_Phase.create({
                        data: {
                            campaign_id: campaignId,
                            phase_name: phase.phaseName,
                            location: phase.location,
                            ingredient_purchase_date:
                                phase.ingredientPurchaseDate,
                            cooking_date: phase.cookingDate,
                            delivery_date: phase.deliveryDate,
                            status: CampaignPhaseStatus.PLANNING,
                            is_active: true,
                        },
                    }),
                ),
            )

            return createdPhases.map((phase) => this.mapToGraphQLModel(phase))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createManyCampaignPhases",
                campaignId,
                phaseCount: phases.length,
            })
            throw error
        }
    }

    async findById(id: string) {
        try {
            const phase = await this.prisma.campaign_Phase.findUnique({
                where: { id, is_active: true },
            })

            return phase ? this.mapToGraphQLModel(phase) : null
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findPhaseById",
                phaseId: id,
            })
            throw error
        }
    }

    async findByCampaignId(campaignId: string) {
        try {
            const phases = await this.prisma.campaign_Phase.findMany({
                where: {
                    campaign_id: campaignId,
                    is_active: true,
                },
                orderBy: { created_at: "asc" },
            })

            return phases.map((phase) => this.mapToGraphQLModel(phase))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findPhasesByCampaignId",
                campaignId,
            })
            throw error
        }
    }

    async update(id: string, data: UpdatePhaseData) {
        try {
            const updateData: any = {}

            if (data.phaseName !== undefined)
                updateData.phase_name = data.phaseName
            if (data.location !== undefined) updateData.location = data.location
            if (data.ingredientPurchaseDate !== undefined)
                updateData.ingredient_purchase_date =
                    data.ingredientPurchaseDate
            if (data.cookingDate !== undefined)
                updateData.cooking_date = data.cookingDate
            if (data.deliveryDate !== undefined)
                updateData.delivery_date = data.deliveryDate
            if (data.status !== undefined) updateData.status = data.status

            const phase = await this.prisma.campaign_Phase.update({
                where: { id, is_active: true },
                data: updateData,
            })

            return this.mapToGraphQLModel(phase)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "updateCampaignPhase",
                phaseId: id,
                updateFields: Object.keys(data),
            })
            throw error
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            const phase = await this.prisma.campaign_Phase.findUnique({
                where: { id, is_active: true },
            })

            if (!phase) {
                return false
            }

            await this.prisma.campaign_Phase.update({
                where: { id },
                data: {
                    is_active: false,
                    updated_at: new Date(),
                },
            })

            this.sentryService.addBreadcrumb(
                "Campaign phase soft deleted",
                "campaign-phase",
                {
                    phaseId: id,
                    campaignId: phase.campaign_id,
                },
            )

            return true
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "deleteCampaignPhase",
                phaseId: id,
            })
            throw error
        }
    }

    async deleteMany(ids: string[]): Promise<number> {
        try {
            if (ids.length === 0) {
                return 0
            }

            const result = await this.prisma.campaign_Phase.updateMany({
                where: {
                    id: { in: ids },
                    is_active: true,
                },
                data: {
                    is_active: false,
                    updated_at: new Date(),
                },
            })

            this.sentryService.addBreadcrumb(
                "Campaign phases batch deleted",
                "campaign-phase",
                {
                    phaseIds: ids,
                    deletedCount: result.count,
                },
            )

            return result.count
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "deleteManyCampaignPhases",
                phaseIds: ids,
            })
            throw error
        }
    }

    private mapToGraphQLModel(dbPhase: any) {
        return {
            id: dbPhase.id,
            campaignId: dbPhase.campaign_id,
            phaseName: dbPhase.phase_name,
            location: dbPhase.location,
            ingredientPurchaseDate: dbPhase.ingredient_purchase_date,
            cookingDate: dbPhase.cooking_date,
            deliveryDate: dbPhase.delivery_date,
            status: dbPhase.status as CampaignPhaseStatus,
            created_at: dbPhase.created_at,
            updated_at: dbPhase.updated_at,
        }
    }
}
