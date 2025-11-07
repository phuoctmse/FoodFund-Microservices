import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType("PostMedia")
export class MediaUploadUrl {
    @Field(() => String, {
        description: "Presigned URL for uploading this file",
    })
        uploadUrl: string

    @Field(() => String, {
        description: "File key to use when creating/updating post",
    })
        fileKey: string

    @Field(() => String, {
        description: "CDN URL where file will be accessible after upload",
    })
        cdnUrl: string

    @Field(() => Date, {
        description: "When this upload URL expires (5 minutes)",
    })
        expiresAt: Date

    @Field(() => String, {
        nullable: true,
        description: "File type (image/video)",
    })
        fileType?: string
}

@ObjectType()
export class PostMediaUploadResponse {
    @Field(() => Boolean, {
        description: "Operation success status",
    })
        success: boolean

    @Field(() => String, {
        description: "Response message",
    })
        message: string

    @Field(() => [MediaUploadUrl], {
        description: "Array of upload URLs for each file",
    })
        uploadUrls: MediaUploadUrl[]

    @Field(() => String, {
        description: "Upload instructions",
    })
        instructions: string
}
