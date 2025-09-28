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

export function isValidUUID(
    uuid: string,
    options: UUIDValidationOptions = {},
): boolean {
    const result = validateUUID(uuid, options)
    return result.isValid
}

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

export function generateTestUUID(): string {
    const chars = "0123456789abcdef"
    let uuid = ""

    for (let i = 0; i < 32; i++) {
        if (i === 12) {
            uuid += "4"
        } else if (i === 16) {
            uuid += chars[Math.floor(Math.random() * 4) + 8]
        } else {
            uuid += chars[Math.floor(Math.random() * 16)]
        }
    }

    return formatUUID(uuid)
}

export function isUUIDString(
    value: unknown,
    options?: UUIDValidationOptions,
): value is string {
    return typeof value === "string" && isValidUUID(value, options)
}