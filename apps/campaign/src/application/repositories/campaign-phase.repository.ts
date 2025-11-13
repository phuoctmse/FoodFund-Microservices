import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/campaign-client"
import { SentryService } from "@libs/observability"
import { CampaignPhaseStatus } from "../../domain/enums/campaign-phase/campaign-phase.enum"

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
    }

    async createMany(campaignId: string, phases: CreatePhaseData[]) {
        const createdPhases = await this.prisma.$transaction(
            phases.map((phase) =>
                this.prisma.campaign_Phase.create({
                    data: {
                        campaign_id: campaignId,
                        phase_name: phase.phaseName,
                        location: phase.location,
                        ingredient_purchase_date: phase.ingredientPurchaseDate,
                        cooking_date: phase.cookingDate,
                        delivery_date: phase.deliveryDate,
                        status: CampaignPhaseStatus.PLANNING,
                        is_active: true,
                    },
                }),
            ),
        )

        return createdPhases.map((phase) => this.mapToGraphQLModel(phase))
    }

    async findById(id: string) {
        const phase = await this.prisma.campaign_Phase.findUnique({
            where: { id, is_active: true },
        })

        return phase ? this.mapToGraphQLModel(phase) : null
    }

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
            select: {
                id: true,
                campaign_id: true,
                phase_name: true,
                location: true,
                ingredient_purchase_date: true,
                cooking_date: true,
                delivery_date: true,
                status: true,
                created_at: true,
                updated_at: true,
            },
            orderBy: { created_at: "asc" },
        })

        return phases.map((phase) => this.mapToGraphQLModel(phase))
    }

    async update(id: string, data: UpdatePhaseData) {
        const updateData: any = {}

        if (data.phaseName !== undefined) updateData.phase_name = data.phaseName
        if (data.location !== undefined) updateData.location = data.location
        if (data.ingredientPurchaseDate !== undefined)
            updateData.ingredient_purchase_date = data.ingredientPurchaseDate
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
    }

    async delete(id: string): Promise<boolean> {
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
    }

    async deleteMany(ids: string[]): Promise<number> {
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
