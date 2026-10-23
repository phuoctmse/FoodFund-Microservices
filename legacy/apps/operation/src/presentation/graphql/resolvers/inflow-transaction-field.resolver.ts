import { Parent, ResolveField, Resolver } from "@nestjs/graphql"
import { User, CampaignPhase, Organization } from "../../../shared"
import { InflowTransaction } from "@app/operation/src/domain"
import { GrpcClientService } from "@libs/grpc"
import { Logger } from "@nestjs/common"

@Resolver(() => InflowTransaction)
export class InflowTransactionFieldResolver {
    private readonly logger = new Logger(InflowTransactionFieldResolver.name)

    constructor(private readonly grpcClient: GrpcClientService) {}

    @ResolveField("receiver", () => User, {
        description: "Resolve fundraiser who receives the disbursement",
        nullable: true,
    })
    async resolveReceiver(@Parent() transaction: any): Promise<User | null> {
        const receiverId = transaction.receiverId || transaction.receiver_id

        if (!receiverId) {
            return null
        }

        return {
            id: receiverId,
            __typename: "User",
        }
    }

    @ResolveField("campaignPhase", () => CampaignPhase, {
        description: "Resolve campaign phase this disbursement belongs to",
        nullable: true,
    })
    async resolveCampaignPhase(
        @Parent() transaction: any,
    ): Promise<CampaignPhase | null> {
        const campaignPhaseId =
            transaction.campaignPhaseId || transaction.campaign_phase_id

        if (!campaignPhaseId) {
            this.logger.error(
                "⚠️ [campaignPhase resolver] No campaignPhaseId found"
            )
            return null
        }

        return {
            id: campaignPhaseId,
            __typename: "CampaignPhase",
        }
    }

    @ResolveField("organization", () => Organization, {
        description: "Resolve organization of the fundraiser",
        nullable: true,
    })
    async resolveOrganization(
        @Parent() transaction: any,
    ): Promise<Organization | null> {
        const receiverId = transaction.receiverId || transaction.receiver_id

        if (!receiverId) {
            return null
        }

        try {
            const response = await this.grpcClient.callUserService<
                { userId: string },
                {
                    success: boolean
                    organization?: { id: string; name: string }
                    error?: string
                }
            >("GetUserOrganization", { userId: receiverId })

            if (!response.success || !response.organization) {
                this.logger.error(
                    "⚠️ [organization resolver] No organization found:",
                    response.error,
                )
                return null
            }

            return {
                id: response.organization.id,
                __typename: "Organization",
            }
        } catch (error) {
            this.logger.error("❌ [organization resolver] Error: ", error.message)
            return null
        }
    }
}
