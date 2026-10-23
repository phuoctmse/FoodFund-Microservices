/**
 * Generate a unique username from email, avoiding domain exposure.
 * @param email - User's email address
 * @param existingUsernames - Array of existing usernames to avoid duplicates
 * @returns A unique, privacy-friendly username
 */
export function generateUniqueUsername(
    email: string,
    existingUsernames: string[] = [],
): string {
    if (typeof email !== "string" || !email.includes("@")) {
        return generateRandomUsername()
    }

    const baseUsername = extractBaseUsername(email)
    if (!baseUsername) {
        return generateRandomUsername()
    }

    // Nếu chưa trùng, dùng luôn
    if (!existingUsernames.includes(baseUsername)) {
        return baseUsername
    }

    // Thử tối đa 3 lần với hậu tố random ngắn (không dùng domain)
    for (let i = 0; i < 3; i++) {
        const randomSuffix = getRandomString(4)
        const candidate = `${baseUsername}${randomSuffix}`.slice(0, 20)
        if (!existingUsernames.includes(candidate)) {
            return candidate
        }
    }

    // Nếu vẫn trùng, fallback random hoàn toàn
    return generateRandomUsername()
}

/**
 * Extract base username from email (part before @)
 * @param email - User's email address
 * @returns Base username (max 14 chars)
 */
function extractBaseUsername(email: string): string {
    const atIndex = email.indexOf("@")
    if (atIndex <= 0) return ""
    // Clean và giới hạn 14 ký tự để còn chỗ cho hậu tố
    return email
        .substring(0, atIndex)
        .replace(/[^a-zA-Z0-9_]/g, "")
        .toLowerCase()
        .slice(0, 14)
}

/**
 * Sinh chuỗi random gồm 4 ký tự chữ và số
 */
function getRandomString(length: number): string {
    return Math.random()
        .toString(36)
        .substring(2, 2 + length)
}

/**
 * Generate a random username as last resort
 * @returns Random username
 */
function generateRandomUsername(): string {
    const timestamp = Date.now().toString().slice(-6)
    const random = getRandomString(6)
    return `user${timestamp}${random}`.slice(0, 20)
}

/**
 * Validate username format
 * @param username - Username to validate
 * @returns True if valid
 */
export function isValidUsername(username: string): boolean {
    if (!username || typeof username !== "string") return false
    // Must be 3-20 characters, alphanumeric and underscore only
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    return usernameRegex.test(username)
}
