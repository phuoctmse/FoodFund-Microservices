import {
    DeleteObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { SentryService } from "@libs/observability/sentry.service"
import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { randomBytes } from "node:crypto"
import { v4 as uuidv4 } from "uuid"

interface BatchUploadResult {
    uploadUrl: string
    fileKey: string
    cdnUrl: string
    expiresAt: Date
    fileType?: string
}

@Injectable()
export class SpacesUploadService {
    private readonly logger = new Logger(SpacesUploadService.name)
    private readonly s3Client: S3Client
    private readonly bucketName = process.env.SPACES_BUCKET_NAME!
    private readonly region = process.env.SPACES_REGION!
    private readonly originEndpoint = process.env.SPACES_ORIGIN_ENDPOINT!
    private readonly cdnEndpoint = process.env.SPACES_CDN_ENDPOINT!
    private readonly SUPPORTED_IMAGE_TYPES = [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
    ]
    private readonly SUPPORTED_VIDEO_TYPES = ["mp4", "webm", "mov"]
    private readonly MAX_FILE_SIZE = {
        image: 10 * 1024 * 1024,
        video: 100 * 1024 * 1024,
    }

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

    async generateBatchImageUploadUrls(
        userId: string,
        resource: string,
        fileCount: number,
        fileTypes?: string[],
        resourceId?: string,
    ): Promise<BatchUploadResult[]> {
        try {
            if (fileCount < 1 || fileCount > 10) {
                throw new BadRequestException(
                    "File count must be between 1 and 10",
                )
            }

            const results: BatchUploadResult[] = []
            const timestamp = new Date().toISOString().split("T")[0]
            const tempId = resourceId || `temp-${Date.now()}`

            for (let i = 0; i < fileCount; i++) {
                const fileType = fileTypes?.[i] || "jpg"
                const { extension, contentType, category } =
                    this.getFileMetadata(fileType)

                const randomPrefix = this.generateRandomPrefix()
                const fileKey = `${resource}/${timestamp}/${randomPrefix}-${tempId}-${userId}-${i + 1}.${extension}`

                const command = new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: fileKey,
                    ContentType: contentType,
                    Metadata: {
                        "uploaded-by": userId,
                        "resource-id": resourceId || "pending",
                        "upload-type": "post-media",
                        "file-index": String(i),
                        "file-category": category,
                        "created-at": new Date().toISOString(),
                    },
                    ACL: "public-read",
                })

                const uploadUrl = await getSignedUrl(this.s3Client, command, {
                    expiresIn: 300,
                })

                const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
                const cdnUrl = `${this.cdnEndpoint}/${fileKey}`

                results.push({
                    uploadUrl,
                    fileKey,
                    cdnUrl,
                    expiresAt,
                    fileType: category,
                })
            }

            return results
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "generateBatchImageUploadUrls",
                userId,
                resource,
                fileCount,
            })
            throw new BadRequestException(
                "Failed to generate batch upload URLs",
            )
        }
    }

    private getFileMetadata(fileType: string): {
        extension: string
        contentType: string
        category: "image" | "video"
    } {
        const normalizedType = fileType.toLowerCase().trim()

        if (this.SUPPORTED_IMAGE_TYPES.includes(normalizedType)) {
            const contentTypeMap: Record<string, string> = {
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                png: "image/png",
                webp: "image/webp",
                gif: "image/gif",
            }

            return {
                extension: normalizedType === "jpg" ? "jpeg" : normalizedType,
                contentType: contentTypeMap[normalizedType] || "image/jpeg",
                category: "image",
            }
        }

        if (this.SUPPORTED_VIDEO_TYPES.includes(normalizedType)) {
            const contentTypeMap: Record<string, string> = {
                mp4: "video/mp4",
                webm: "video/webm",
                mov: "video/quicktime",
            }

            return {
                extension: normalizedType,
                contentType: contentTypeMap[normalizedType] || "video/mp4",
                category: "video",
            }
        }

        return {
            extension: "jpeg",
            contentType: "image/jpeg",
            category: "image",
        }
    }

    async validateFileKeys(
        fileKeys: string[],
        userId: string,
        resource: string,
    ): Promise<{ valid: boolean; invalidKeys: string[] }> {
        const invalidKeys: string[] = []

        for (const fileKey of fileKeys) {
            if (!fileKey.startsWith(`${resource}/`)) {
                invalidKeys.push(fileKey)
                continue
            }

            if (!fileKey.includes(userId)) {
                invalidKeys.push(fileKey)
            }
        }

        return {
            valid: invalidKeys.length === 0,
            invalidKeys,
        }
    }

    async deleteBatchFiles(fileKeys: string[]): Promise<void> {
        try {
            const deletePromises = fileKeys.map((fileKey) =>
                this.deleteResourceImage(fileKey),
            )

            await Promise.allSettled(deletePromises)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "deleteBatchFiles",
                fileCount: fileKeys.length,
            })
        }
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
            this.sentryService.captureError(error as Error, {
                operation: "deleteCampaignImage",
                fileKey,
            })
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
            return uuidv4().replaceAll("-", "").substring(0, 8)
        } catch (error) {
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
