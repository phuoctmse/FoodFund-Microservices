import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class BadgeUploadUrl {
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
export class BadgeUploadResponse {
        @Field()
            success: boolean

        @Field()
            message: string

        @Field(() => BadgeUploadUrl)
            uploadUrl: BadgeUploadUrl

        @Field({ description: "Upload instructions" })
            instructions: string
}
