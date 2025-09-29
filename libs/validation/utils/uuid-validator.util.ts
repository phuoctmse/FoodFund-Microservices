import { randomBytes } from "crypto"

export interface UUIDValidationOptions {
    allowRelaxedFormat?: boolean
    allowedVersions?: number[]
    caseSensitive?: boolean
}

export interface UUIDValidationResult {
    isValid: boolean
    version?: number
    normalized?: string
    error?: string
}

/**
 * Validates UUID format and version
 * @param uuid - UUID string to validate
 * @param options - Validation options
 * @returns boolean indicating if UUID is valid
 */
export function isValidUUID(
    uuid: string,
    options: UUIDValidationOptions = {},
): boolean {
    const result = validateUUID(uuid, options)
    return result.isValid
}

/**
 * Comprehensive UUID validation with detailed results
 * @param uuid - UUID string to validate
 * @param options - Validation options
 * @returns Detailed validation result
 */
export function validateUUID(
    uuid: string,
    options: UUIDValidationOptions = {},
): UUIDValidationResult {
    const {
        allowRelaxedFormat = true,
        allowedVersions = [1, 3, 4, 5],
        caseSensitive = false,
    } = options

    if (!uuid || typeof uuid !== "string") {
        return {
            isValid: false,
            error: "UUID must be a non-empty string",
        }
    }

    const normalizedUuid = caseSensitive ? uuid : uuid.toLowerCase()
    const cleanUuid = normalizedUuid.replace(/-/g, "")

    if (cleanUuid.length !== 32) {
        return {
            isValid: false,
            error: `UUID must be 32 hexadecimal characters, got ${cleanUuid.length}`,
        }
    }

    const hexRegex = /^[0-9a-f]+$/i
    if (!hexRegex.test(cleanUuid)) {
        return {
            isValid: false,
            error: "UUID must contain only hexadecimal characters (0-9, a-f)",
        }
    }

    const standardUuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    const relaxedUuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    let isStandardFormat = false
    let isRelaxedFormat = false
    let detectedVersion: number | undefined

    if (standardUuidRegex.test(normalizedUuid)) {
        isStandardFormat = true
        detectedVersion = parseInt(normalizedUuid.charAt(14), 10)
    } else if (allowRelaxedFormat && relaxedUuidRegex.test(normalizedUuid)) {
        isRelaxedFormat = true
        const versionChar = normalizedUuid.charAt(14)
        const versionNum = parseInt(versionChar, 10)
        if (versionNum >= 1 && versionNum <= 5) {
            detectedVersion = versionNum
        }
    }

    if (!isStandardFormat && !isRelaxedFormat) {
        return {
            isValid: false,
            error: allowRelaxedFormat
                ? "UUID format is invalid (must match standard or relaxed UUID pattern)"
                : "UUID format is invalid (must match standard UUID pattern)",
        }
    }

    if (detectedVersion && !allowedVersions.includes(detectedVersion)) {
        return {
            isValid: false,
            error: `UUID version ${detectedVersion} is not allowed. Allowed versions: ${allowedVersions.join(", ")}`,
        }
    }

    return {
        isValid: true,
        version: detectedVersion,
        normalized: formatUUID(cleanUuid),
        error: undefined,
    }
}

/**
 * Formats a clean UUID string with proper hyphens
 * @param cleanUuid - 32-character hex string
 * @returns Properly formatted UUID string
 */
export function formatUUID(cleanUuid: string): string {
    if (cleanUuid.length !== 32) {
        throw new Error("Clean UUID must be exactly 32 characters")
    }

    return [
        cleanUuid.substring(0, 8),
        cleanUuid.substring(8, 12),
        cleanUuid.substring(12, 16),
        cleanUuid.substring(16, 20),
        cleanUuid.substring(20, 32),
    ]
        .join("-")
        .toLowerCase()
}

/**
 * Generates a cryptographically secure test UUID v4
 * @returns A valid UUID v4 string
 */
export function generateTestUUID(): string {
    try {
        const randomBytesBuffer = randomBytes(16)
        const randomHex = randomBytesBuffer.toString("hex")

        const chars = randomHex.split("")

        chars[12] = "4"

        const variantOptions = ["8", "9", "a", "b"]
        const variantIndex = randomBytesBuffer[8] % 4
        chars[16] = variantOptions[variantIndex]

        const cleanUuid = chars.join("")
        return formatUUID(cleanUuid)
    } catch (error) {
        console.warn(
            "Failed to generate secure UUID, using fallback:",
            error.message,
        )
        return "12345678-1234-4000-8000-123456789abc"
    }
}

/**
 * Type guard to check if value is a valid UUID string
 * @param value - Value to check
 * @param options - Validation options
 * @returns Type predicate indicating if value is a valid UUID string
 */
export function isUUIDString(
    value: unknown,
    options?: UUIDValidationOptions,
): value is string {
    return typeof value === "string" && isValidUUID(value, options)
}

/**
 * Generates a cryptographically secure random UUID v4
 * @returns A secure UUID v4 string
 */
export function generateSecureUUID(): string {
    try {
        const randomBytesBuffer = randomBytes(16)
        const bytes = Array.from(randomBytesBuffer)

        bytes[6] = (bytes[6] & 0x0f) | 0x40
        bytes[8] = (bytes[8] & 0x3f) | 0x80

        const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("")

        return formatUUID(hex)
    } catch (error) {
        throw new Error(`Failed to generate secure UUID: ${error.message}`)
    }
}
