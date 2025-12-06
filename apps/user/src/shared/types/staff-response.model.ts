import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class CreateStaffAccountResponse {
    @Field()
        success: boolean

    @Field()
        message: string

    @Field()
        userId: string

    @Field()
        cognitoId: string

    @Field()
        hasLoginAccess: boolean

    @Field()
        temporaryPasswordSent: boolean
}
