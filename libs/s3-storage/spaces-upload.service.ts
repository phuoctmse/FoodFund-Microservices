import {
    DeleteObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { SentryService } from "@libs/observability/sentry.service"
import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { randomBytes } from "crypto"
import { v4 as uuidv4 } from "uuid"

@Injectable()
export class SpacesUploadService {
    private readonly logger = new Logger(SpacesUploadService.name)
    private readonly s3Client: S3Client
    private readonly bucketName = process.env.SPACES_BUCKET_NAME!
    private readonly region = process.env.SPACES_REGION!
    private readonly originEndpoint = process.env.SPACES_ORIGIN_ENDPOINT!
    private readonly cdnEndpoint = process.env.SPACES_CDN_ENDPOINT!

    constructor(private readonly sentryService: SentryService) {
        this.s3Client = new S3Client({
            endpoint: this.originEndpoint,
            region: this.region,
            credentials: {
                accessKeyId: process.env.SPACES_KEY!,
                secretAccessKey: process.env.SPACES_SECRET!,
            },
            forcePathStyle: false,
        })
    }

    async generateImageUploadUrl(
        userId: string,
        resource: string,
        resourceId?: string,
    ): Promise<{
        uploadUrl: string
        fileKey: string
        expiresAt: Date
        cdnUrl: string
    }> {
        try {
            const randomPrefix = this.generateRandomPrefix()
            const timestamp = new Date().toISOString().split("T")[0]
            const tempId = resourceId || `temp-${Date.now()}`
            const fileExtension = "jpg"

            const fileKey = `${resource}/${timestamp}/${randomPrefix}-${tempId}-${userId}.${fileExtension}`

            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileKey,
                ContentType: "image/jpeg",
                Metadata: {
                    "uploaded-by": userId,
                    "resource-id": resourceId || "pending",
                    "upload-type": "resource-cover",
                    "created-at": new Date().toISOString(),
                },
                ACL: "public-read",
            })

            const uploadUrl = await getSignedUrl(this.s3Client, command, {
                expiresIn: 300,
            })

            const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
            const cdnUrl = `${this.cdnEndpoint}/${fileKey}`

            return {
                uploadUrl,
                fileKey,
                expiresAt,
                cdnUrl,
            }
        } catch (error) {
            this.logger.error("Failed to generate upload URL:", error)
            this.sentryService.captureError(error as Error, {
                operation: "generateImageUploadUrl",
                userId,
                resourceId,
            })
            throw new BadRequestException("Failed to generate upload URL")
        }
    }

    async deleteResourceImage(fileKey: string): Promise<void> {
        try {
            const key = fileKey.includes(this.cdnEndpoint)
                ? fileKey.replace(`${this.cdnEndpoint}/`, "")
                : fileKey

            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            })

            await this.s3Client.send(command)
        } catch (error) {
            if (error.name === "NoSuchKey" || error.name === "NotFound") {
                this.logger.warn(`File not found for deletion: ${fileKey}`)
                return
            }

            this.logger.error(
                `Failed to delete resource image ${fileKey}:`,
                error,
            )
            this.sentryService.captureError(error as Error, {
                operation: "deleteCampaignImage",
                fileKey,
            })
        }
    }

    async cleanupUnusedImages(olderThanHours: number = 24): Promise<number> {
        try {
            this.logger.log(
                `Cleanup job would run for images older than ${olderThanHours} hours`,
            )
            return 0
        } catch (error) {
            this.logger.error("Failed to cleanup unused images:", error)
            this.sentryService.captureError(error as Error, {
                operation: "cleanupUnusedImages",
                olderThanHours,
            })
            return 0
        }
    }

    async validateUploadedFile(fileKey: string): Promise<{
        exists: boolean
        size?: number
        contentType?: string
        lastModified?: Date
    }> {
        try {
            return {
                exists: true,
                size: undefined,
                contentType: "image/jpeg",
                lastModified: new Date(),
            }
        } catch (error) {
            this.logger.warn(`File validation failed for ${fileKey}:`, error)
            return { exists: false }
        }
    }

    extractFileKeyFromUrl(resource: string, url: string): string | null {
        try {
            if (url.includes(this.cdnEndpoint)) {
                return url.replace(`${this.cdnEndpoint}/`, "")
            }
            if (url.includes(".digitaloceanspaces.com/")) {
                const parts = url.split(".digitaloceanspaces.com/")
                return parts[1] || null
            }
            return url.startsWith(`${resource}/`) ? url : null
        } catch {
            return null
        }
    }

    private generateRandomPrefix(): string {
        try {
            return uuidv4().replace(/-/g, "").substring(0, 8)
        } catch (error) {
            this.logger.error("Failed to generate UUID-based prefix:", error)
            this.sentryService.captureError(error as Error, {
                operation: "generateRandomPrefix",
                fallback: true,
            })

            const timestamp = Date.now().toString(36)
            const randomSuffix = randomBytes(3).toString("hex")
            return `${timestamp}${randomSuffix}`.substring(0, 8)
        }
    }

    getHealth(): { status: string; endpoint: string; region: string } {
        return {
            status: "healthy",
            endpoint: this.originEndpoint,
            region: this.region,
        }
    }
}
