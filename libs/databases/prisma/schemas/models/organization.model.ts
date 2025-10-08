import { ObjectType, Field, ID } from "@nestjs/graphql"
import { Directive } from "@nestjs/graphql"
import { AbstractSchema } from "../abstract.schema"
import { VerificationStatus } from "../enums/user.enums"
import { UserProfileSchema } from "./user-profiles.model"

@ObjectType()
@Directive("@shareable")
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