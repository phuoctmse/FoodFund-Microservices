import { Field, ObjectType } from "@nestjs/graphql"
import { MediaUploadUrl } from "./media-upload-url.response"

@ObjectType()
export class ExpenseProofUploadResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => [MediaUploadUrl])
        uploadUrls: MediaUploadUrl[]

    @Field(() => String)
        instructions: string
}
