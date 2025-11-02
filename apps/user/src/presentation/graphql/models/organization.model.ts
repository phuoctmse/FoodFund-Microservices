import { ObjectType, Field, Directive } from "@nestjs/graphql"
import { VerificationStatus } from "../../../domain/enums"

/**
 * GraphQL Model: Organization
 * Represents an organization in the system
 */
@ObjectType("Organization")
@Directive("@key(fields: \"id\")")
export class OrganizationModel {
    @Field(() => String, { description: "Organization ID" })
        id: string

    @Field(() => String, { description: "Organization name" })
        name: string

    @Field(() => String, {
        description: "Organization description",
        nullable: true,
    })
        description?: string

    @Field(() => String, {
        description: "Organization address",
        nullable: true,
    })
        address?: string

    @Field(() => String, {
        description: "Organization phone number",
        nullable: true,
    })
        phone_number?: string

    @Field(() => String, {
        description: "Organization website URL",
        nullable: true,
    })
        website?: string

    @Field(() => VerificationStatus, {
        description: "Organization verification status",
    })
        status: VerificationStatus

    @Field(() => String, { description: "Representative user ID" })
        representative_id: string

    @Field(() => Date, { description: "Creation date" })
        created_at: Date

    @Field(() => Date, { description: "Last update date" })
        updated_at: Date
}
