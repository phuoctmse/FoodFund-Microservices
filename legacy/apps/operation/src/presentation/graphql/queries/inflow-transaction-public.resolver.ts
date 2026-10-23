import { Args, Query, Resolver } from "@nestjs/graphql"
import { PrismaClient } from "@app/operation/src/generated/operation-client"
import { PublicDisbursement } from "../../../application/dtos"
import { InflowTransactionStatus, InflowTransactionType } from "../../../domain/enums"
import { UserClientService } from "../../../shared/services/user-client.service"
import { Role } from "@libs/databases"

@Resolver()
export class InflowTransactionPublicResolver {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly userClientService: UserClientService,
    ) {}

    @Query(() => [PublicDisbursement], {
        name: "getPublicPhaseDisbursements",
        description:
            "Get public disbursements for a specific campaign phase. " +
            "Shows only COMPLETED disbursements for transparency. " +
            "Useful for donors to see how funds are being spent.",
    })
    async getPublicPhaseDisbursements(
        @Args("campaignPhaseId", { type: () => String }) campaignPhaseId: string,
    ): Promise<PublicDisbursement[]> {
        const completedDisbursements = await this.prisma.inflow_Transaction.findMany({
            where: {
                campaign_phase_id: campaignPhaseId,
                status: InflowTransactionStatus.COMPLETED,
            },
            orderBy: {
                created_at: "desc",
            },
        })

        const receiverIds = [...new Set(completedDisbursements.map((d) => d.receiver_id))]
        const receiversMap = new Map<string, { id: string; fullName: string; username: string, email: string, role: Role }>()

        await Promise.all(
            receiverIds.map(async (receiverId) => {
                const user = await this.userClientService.getUserByCognitoId(receiverId)
                if (user) {
                    receiversMap.set(receiverId, {
                        id: user.id,
                        fullName: user.fullName || "Unknown",
                        username: user.username || "Unknown",
                        email: user.email || "Unknown",
                        role: Role.FUNDRAISER,
                    })
                }
            }),
        )

        return completedDisbursements.map((d) => ({
            id: d.id,
            campaignPhaseId: d.campaign_phase_id,
            transactionType: d.transaction_type as InflowTransactionType,
            amount: d.amount.toString(),
            proof: d.proof || undefined,
            receiver: receiversMap.get(d.receiver_id),
            createdAt: d.created_at,
            completedAt: d.reported_at || d.updated_at,
        }))
    }
}
