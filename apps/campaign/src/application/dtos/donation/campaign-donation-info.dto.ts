import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class CampaignDonationInfo {
    @Field(() => String, { description: "Bank account number" })
        bankAccountNumber: string

    @Field(() => String, { description: "Bank account name" })
        bankAccountName: string

    @Field(() => String, { description: "Bank name (full name)" })
        bankName: string

    @Field(() => String, {
        description: "Bank code for QR generation (e.g., MB, VCB)",
    })
        bankCode: string

    @Field(() => String, {
        description:
            "Transfer description (encoded with campaignId and userId)",
    })
        transferDescription: string

    @Field(() => Boolean, {
        description: "Whether user is authenticated (donation will be tracked)",
    })
        isAuthenticated: boolean
}
