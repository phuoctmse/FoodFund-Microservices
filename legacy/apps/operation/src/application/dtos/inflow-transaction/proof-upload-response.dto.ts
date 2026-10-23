import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class ProofUploadUrl {
    @Field(() => String, {
        description: "Presigned URL to upload the file",
    })
        uploadUrl: string

    @Field(() => String, {
        description: "File key/path in S3 to be used when creating the transaction",
    })
        fileKey: string

    @Field(() => String, {
        description: "CDN URL to access the file after upload",
    })
        cdnUrl: string

    @Field(() => Date, {
        description: "Upload URL expiration time",
    })
        expiresAt: Date

    @Field(() => String, {
        nullable: true,
        description: "File type",
    })
        fileType?: string
}

@ObjectType()
export class ProofUploadResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => ProofUploadUrl, {
        description: "Upload URL details",
    })
        uploadUrl: ProofUploadUrl

    @Field(() => String, {
        description: "Instructions on how to upload the file",
    })
        instructions: string
}
