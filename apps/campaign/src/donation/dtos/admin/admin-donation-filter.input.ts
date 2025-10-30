import { Field, InputType, registerEnumType } from "@nestjs/graphql"

export enum AdminDonationStatus {
    ALL = "ALL",
    SUCCESS = "SUCCESS",
    PENDING = "PENDING",
    FAILED = "FAILED",
    REFUNDED = "REFUNDED",
}

export enum AdminDonationSortField {
    AMOUNT = "amount",
    CREATED_AT = "createdAt",
    TRANSACTION_DATE = "transactionDate",
}

export enum AdminSortOrder {
    ASC = "asc",
    DESC = "desc",
}

registerEnumType(AdminDonationStatus, {
    name: "AdminDonationStatus",
    description: "Donation status filter for admin",
})

registerEnumType(AdminDonationSortField, {
    name: "AdminDonationSortField",
    description: "Fields available for sorting donations",
})

registerEnumType(AdminSortOrder, {
    name: "AdminSortOrder",
    description: "Sort order direction",
})

@InputType()
export class AdminDonationFilterInput {
    @Field(() => AdminDonationStatus, {
        nullable: true,
        description: "Filter by status",
    })
        status?: AdminDonationStatus

    @Field(() => String, {
        nullable: true,
        description: "Filter by campaign ID",
    })
        campaignId?: string

    @Field(() => String, {
        nullable: true,
        description: "Search by donor name",
    })
        searchDonorName?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by start date (ISO string)",
    })
        startDate?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by end date (ISO string)",
    })
        endDate?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by minimum amount",
    })
        minAmount?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by maximum amount",
    })
        maxAmount?: string

    @Field(() => AdminDonationSortField, {
        nullable: true,
        description: "Field to sort by",
    })
        sortBy?: AdminDonationSortField

    @Field(() => AdminSortOrder, {
        nullable: true,
        description: "Sort order",
    })
        sortOrder?: AdminSortOrder
}
