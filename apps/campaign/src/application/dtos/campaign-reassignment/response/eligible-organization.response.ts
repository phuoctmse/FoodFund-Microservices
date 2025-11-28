import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class EligibleOrganization {
    @Field(() => String, { description: "Organization ID" })
        id: string

    @Field(() => String, { description: "Organization name" })
        name: string

    @Field(() => String, { description: "Representative name" })
        representativeName: string

    @Field(() => String, { nullable: true, description: "Activity field" })
        activityField?: string

    @Field(() => String, { nullable: true, description: "Address" })
        address?: string

    @Field(() => String, { nullable: true, description: "Phone number" })
        phoneNumber?: string

    @Field(() => String, { nullable: true, description: "Email" })
        email?: string
}

@ObjectType()
export class EligibleOrganizationsResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => [EligibleOrganization])
        organizations: EligibleOrganization[]

    @Field(() => Number)
        total: number
}