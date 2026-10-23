import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType("ExpenseProofMedia")
export class MediaUploadUrl {
    @Field(() => String)
        uploadUrl: string

    @Field(() => String)
        fileKey: string

    @Field(() => String)
        cdnUrl: string

    @Field(() => Date)
        expiresAt: Date

    @Field(() => String)
        fileType: string
}
