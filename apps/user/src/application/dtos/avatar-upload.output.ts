import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class AvatarUploadUrl {
    @Field({ description: "Presigned URL for uploading the file" })
        uploadUrl: string

    @Field({ description: "File key in storage" })
        fileKey: string

    @Field({ description: "CDN URL to access the uploaded file" })
        cdnUrl: string

    @Field({ description: "Upload URL expiration time" })
        expiresAt: Date

    @Field({ description: "File type" })
        fileType: string
}

@ObjectType()
export class AvatarUploadResponse {
    @Field()
        success: boolean

    @Field()
        message: string

    @Field(() => AvatarUploadUrl)
        uploadUrl: AvatarUploadUrl

    @Field({ description: "Upload instructions" })
        instructions: string
}
