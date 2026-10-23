import { ObjectType, Field, Directive } from "@nestjs/graphql"
import { VerificationStatus } from "../enums/user.enum"
import { UserProfileSchema } from "./user.model"
import { AbstractSchema } from "../../shared/helpers/base.schema"

@ObjectType("Organization")
@Directive("@key(fields: \"id\")")
export class OrganizationSchema extends AbstractSchema {
    @Field(() => String, {
        description: "Organization name",
    })
        name: string

    @Field(() => String, {
        description: "Organization activity field",
    })
        activity_field: string

    @Field(() => String, {
        description: "Organization description",
    })
        description: string

    @Field(() => String, {
        description: "Organization address",
    })
        address: string

    @Field(() => String, {
        description: "Organization phone number",
    })
        phone_number: string

    @Field(() => String, {
        description: "Organization email",
    })
        email: string

    @Field(() => String, {
        description: "Organization website URL",
    })
        website: string

    @Field(() => VerificationStatus, {
        description: "Organization verification status",
    })
        status: VerificationStatus

    @Field(() => String, {
        description: "Reason for rejection, cancellation or inactivity",
        nullable: true,
    })
        reason?: string

    @Field(() => String, {
        description: "Representative user ID",
    })
        representative_id: string

    @Field(() => String, {
        description: "Representative name",
    })
        representative_name: string

    @Field(() => String, {
        description: "Representative identity number (CCCD/CMND)",
    })
        representative_identity_number: string

    @Field(() => String, {
        description: "Bank account name",
    })
        bank_account_name: string

    @Field(() => String, {
        description: "Bank account number",
    })
        bank_account_number: string

    @Field(() => String, {
        description: "Bank name",
    })
        bank_name: string

    @Field(() => String, {
        description: "Bank short name (e.g., VCB, TCB)",
    })
        bank_short_name: string

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
