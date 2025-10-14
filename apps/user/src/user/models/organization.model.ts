import { ObjectType, Field } from "@nestjs/graphql"
import { Directive } from "@nestjs/graphql"
import { AbstractSchema } from "../shared/base.schema"
import { VerificationStatus } from "../enums/user.enum"
import { UserProfileSchema } from "./user.model"

@ObjectType("Organization")
@Directive("@key(fields: \"id\")")
export class OrganizationSchema extends AbstractSchema {
    @Field(() => String, {
        description: "Organization name",
    })
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

    @Field(() => String, {
        description: "Representative user ID",
    })
        representative_id: string

    @Field(() => UserProfileSchema, {
        description: "Organization representative user",
        nullable: true,
    })
        representative?: UserProfileSchema

    __typename?: string

    constructor() {
        super()
    }
}
