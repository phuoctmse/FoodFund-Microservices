import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class SignedUrlResponse {
    @Field(() => String, {
        description:
            "Presigned URL for direct file upload to Digital Ocean Spaces",
    })
        uploadUrl: string

    @Field(() => String, {
        description: "File key to use when creating campaign",
    })
        fileKey: string

    @Field(() => Date, {
        description: "When the upload URL expires (5 minutes from generation)",
    })
        expiresAt: Date

    @Field(() => String, {
        description: "CDN URL where the file will be accessible after upload",
    })
        cdnUrl: string

    @Field(() => String, {
        description: "Instructions for uploading",
    })
        instructions: string
}
