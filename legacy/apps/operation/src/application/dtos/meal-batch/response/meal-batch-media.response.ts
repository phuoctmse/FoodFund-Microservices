import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class MediaUploadUrl {
    @Field(() => String, { description: "Presigned upload URL" })
        uploadUrl: string

    @Field(() => String, { description: "File key for storage" })
        fileKey: string

    @Field(() => String, { description: "CDN URL after upload" })
        cdnUrl: string

    @Field(() => Date, { description: "URL expiration timestamp" })
        expiresAt: Date

    @Field(() => String, { description: "File type (e.g., 'jpg', 'png')" })
        fileType: string
}

@ObjectType()
export class MealBatchMediaUploadResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => [MediaUploadUrl])
        uploadUrls: MediaUploadUrl[]
}
