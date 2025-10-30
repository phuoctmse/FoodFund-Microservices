import { Field, InputType, registerEnumType } from "@nestjs/graphql"

export enum DonationSortField {
    AMOUNT = "amount",
    TRANSACTION_DATE = "transactionDate",
    CREATED_AT = "createdAt",
}

export enum SortOrder {
    ASC = "asc",
    DESC = "desc",
}

registerEnumType(DonationSortField, {
    name: "DonationSortField",
    description: "Fields available for sorting donations",
})

registerEnumType(SortOrder, {
    name: "SortOrder",
    description: "Sort order direction",
})

@InputType()
export class CampaignDonationsFilterInput {
    @Field(() => String, {
        nullable: true,
        description: "Search by donor name (case-insensitive)",
    })
        searchDonorName?: string

    @Field(() => DonationSortField, {
        nullable: true,
        description: "Field to sort by (default: TRANSACTION_DATE)",
    })
        sortBy?: DonationSortField

    @Field(() => SortOrder, {
        nullable: true,
        description: "Sort order (default: DESC)",
    })
        sortOrder?: SortOrder
}
