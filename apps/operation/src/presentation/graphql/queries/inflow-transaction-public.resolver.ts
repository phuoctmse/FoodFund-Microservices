import { Args, Query, Resolver } from "@nestjs/graphql"
import { PrismaClient } from "@app/operation/src/generated/operation-client"
import { PublicDisbursement } from "../../../application/dtos"
import { InflowTransactionStatus, InflowTransactionType } from "../../../domain/enums"

@Resolver()
export class InflowTransactionPublicResolver {
    constructor(private readonly prisma: PrismaClient) {}

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

        return completedDisbursements.map((d) => ({
            id: d.id,
            campaignPhaseId: d.campaign_phase_id,
            transactionType: d.transaction_type as InflowTransactionType,
            amount: d.amount.toString(),
            createdAt: d.created_at,
            completedAt: d.reported_at || d.updated_at,
        }))
    }
}
