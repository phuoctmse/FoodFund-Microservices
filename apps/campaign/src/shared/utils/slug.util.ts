import { randomBytes } from "node:crypto"

const VIETNAMESE_MAP: Record<string, string> = {
    à: "a", á: "a", ả: "a", ã: "a", ạ: "a",
    ă: "a", ằ: "a", ắ: "a", ẳ: "a", ẵ: "a", ặ: "a",
    â: "a", ầ: "a", ấ: "a", ẩ: "a", ẫ: "a", ậ: "a",
    đ: "d",
    è: "e", é: "e", ẻ: "e", ẽ: "e", ẹ: "e",
    ê: "e", ề: "e", ế: "e", ể: "e", ễ: "e", ệ: "e",
    ì: "i", í: "i", ỉ: "i", ĩ: "i", ị: "i",
    ò: "o", ó: "o", ỏ: "o", õ: "o", ọ: "o",
    ô: "o", ồ: "o", ố: "o", ổ: "o", ỗ: "o", ộ: "o",
    ơ: "o", ờ: "o", ớ: "o", ở: "o", ỡ: "o", ợ: "o",
    ù: "u", ú: "u", ủ: "u", ũ: "u", ụ: "u",
    ư: "u", ừ: "u", ứ: "u", ử: "u", ữ: "u", ự: "u",
    ỳ: "y", ý: "y", ỷ: "y", ỹ: "y", ỵ: "y",
    À: "a", Á: "a", Ả: "a", Ã: "a", Ạ: "a",
    Ă: "a", Ằ: "a", Ắ: "a", Ẳ: "a", Ẵ: "a", Ặ: "a",
    Â: "a", Ầ: "a", Ấ: "a", Ẩ: "a", Ẫ: "a", Ậ: "a",
    Đ: "d",
    È: "e", É: "e", Ẻ: "e", Ẽ: "e", Ẹ: "e",
    Ê: "e", Ề: "e", Ế: "e", Ể: "e", Ễ: "e", Ệ: "e",
    Ì: "i", Í: "i", Ỉ: "i", Ĩ: "i", Ị: "i",
    Ò: "o", Ó: "o", Ỏ: "o", Õ: "o", Ọ: "o",
    Ô: "o", Ồ: "o", Ố: "o", Ổ: "o", Ỗ: "o", Ộ: "o",
    Ơ: "o", Ờ: "o", Ớ: "o", Ở: "o", Ỡ: "o", Ợ: "o",
    Ù: "u", Ú: "u", Ủ: "u", Ũ: "u", Ụ: "u",
    Ư: "u", Ừ: "u", Ứ: "u", Ử: "u", Ữ: "u", Ự: "u",
    Ỳ: "y", Ý: "y", Ỷ: "y", Ỹ: "y", Ỵ: "y",
}

function removeVietnameseDiacritics(str: string): string {
    return str
        .split("")
        .map((char) => VIETNAMESE_MAP[char] || char)
        .join("")
}

/**
 * Removes leading hyphens from a string
 * O(n) time complexity, no regex backtracking
 */
function trimLeadingHyphens(str: string): string {
    let i = 0
    while (i < str.length && str[i] === "-") {
        i++
    }
    return str.substring(i)
}

/**
 * Removes trailing hyphens from a string
 * O(n) time complexity, no regex backtracking
 */
function trimTrailingHyphens(str: string): string {
    let i = str.length - 1
    while (i >= 0 && str[i] === "-") {
        i--
    }
    return str.substring(0, i + 1)
}

/**
 * Generates a URL-friendly slug from text
 * @param text - Input text to convert to slug
 * @param maxLength - Maximum length of the slug (default: 100)
 * @returns URL-safe slug string
 *
 * Security: No ReDoS vulnerability - uses safe regex patterns and string operations
 */
export function generateSlug(text: string, maxLength: number = 100): string {
    if (!text || typeof text !== "string") {
        return ""
    }

    const PROCESSING_MAX = 1024
    let slug = text.trim().toLowerCase()

    if (slug.length > PROCESSING_MAX) {
        slug = slug.substring(0, PROCESSING_MAX)
    }

    slug = removeVietnameseDiacritics(slug)
    slug = slug.replaceAll(/[^a-z0-9\s-]/g, "")
    slug = slug.replaceAll(/\s+/g, "-")
    slug = slug.replaceAll(/-+/g, "-")
    slug = trimLeadingHyphens(slug)
    slug = trimTrailingHyphens(slug)

    if (slug.length > maxLength) {
        slug = slug.substring(0, maxLength)
        const lastHyphen = slug.lastIndexOf("-")
        if (lastHyphen > maxLength * 0.7) {
            slug = slug.substring(0, lastHyphen)
        }
        slug = trimTrailingHyphens(slug)
    }

    return slug
}

export function generateUniqueSlug(
    baseSlug: string,
    suffix: string | number,
): string {
    return `${baseSlug}-${suffix}`
}

/**
 * Generates a cryptographically random suffix
 * @param length - Length of the suffix (default: 6)
 * @returns Random alphanumeric string
 */
export function generateRandomSuffix(length: number = 6): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    const bytes = randomBytes(length)
    const result = new Array(length)
    for (let i = 0; i < length; i++) {
        result[i] = chars[bytes[i] % chars.length]
    }
    return result.join("")
}