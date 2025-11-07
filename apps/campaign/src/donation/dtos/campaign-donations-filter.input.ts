import { Field, InputType, registerEnumType } from "@nestjs/graphql"

export enum DonationSortField {
    AMOUNT = "AMOUNT",
    TRANSACTION_DATE = "TRANSACTION_DATE",
    CREATED_AT = "CREATED_AT",
}

export enum SortOrder {
    ASC = "ASC",
    DESC = "DESC",
}

// Register enums for GraphQL
registerEnumType(DonationSortField, {
    name: "DonationSortField",
    description: "Fields available for sorting donations",
    valuesMap: {
        AMOUNT: {
            description: "Sort by donation amount",
        },
        TRANSACTION_DATE: {
            description: "Sort by transaction date",
        },
        CREATED_AT: {
            description: "Sort by creation date",
        },
    },
})

registerEnumType(SortOrder, {
    name: "SortOrder",
    description: "Sort order direction",
    valuesMap: {
        ASC: {
            description: "Ascending order",
        },
        DESC: {
            description: "Descending order",
        },
    },
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
        description: "Field to sort by",
    })
        sortBy?: DonationSortField

    @Field(() => SortOrder, {
        nullable: true,
        description: "Sort order (ascending or descending)",
    })
        sortOrder?: SortOrder
}
