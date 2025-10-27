import { customAlphabet } from "nanoid"

/**
 * Encoding utilities for donation descriptions
 */

export interface DonationDescriptionData {
    campaignId: string
    userId?: string
}

// Custom alphabet for nanoid (alphanumeric only - fits Sepay requirements)
const ALPHABET =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const nanoid = customAlphabet(ALPHABET, 10)

// Map to store UUID -> short code (in-memory cache)
const uuidToShortMap = new Map<string, string>()
const shortToUuidMap = new Map<string, string>()

/**
 * Convert UUID to short code (10 chars)
 * Uses nanoid for compact representation
 */
function uuidToShort(uuid: string): string {
    // Check cache first
    if (uuidToShortMap.has(uuid)) {
        return uuidToShortMap.get(uuid)!
    }

    // Generate new short code
    const shortCode = nanoid()

    // Store in cache
    uuidToShortMap.set(uuid, shortCode)
    shortToUuidMap.set(shortCode, uuid)

    return shortCode
}

/**
 * Convert short code back to UUID
 */
function shortToUuid(shortCode: string): string | null {
    return shortToUuidMap.get(shortCode) || null
}

/**
 * Encode donation data to compact format
 * Format: "DN{shortCampaignId}" or "DN{shortCampaignId}U{shortUserId}"
 *
 * Sepay config:
 * - Tiền tố: DN (2 chars)
 * - Hậu tố: max 30 chars, alphanumeric only
 *
 * Examples:
 * - Anonymous: "DNaBc1234567" (12 chars total)
 * - With user: "DNaBc1234567UxYz9876543" (23 chars total)
 */
export function encodeDonationDescription(
    data: DonationDescriptionData,
): string {
    const campaignShort = uuidToShort(data.campaignId)

    if (data.userId) {
        const userShort = uuidToShort(data.userId)
        // Format: DN{campaignShort}U{userShort}
        const suffix = `${campaignShort}U${userShort}`
        return `DN${suffix}`
    }

    // Format: DN{campaignShort} (anonymous)
    return `DN${campaignShort}`
}

/**
 * Decode donation description from encoded string
 * Format: "DN{shortCampaignId}" or "DN{shortCampaignId}U{shortUserId}"
 *
 * Returns decoded campaignId and userId (if present)
 */
export function decodeDonationDescription(
    description: string,
): DonationDescriptionData | null {
    if (!description) return null

    try {
        // Match format: DN{alphanumeric chars}
        const match = description.match(/DN([A-Za-z0-9]+)/)
        if (!match) return null

        const suffix = match[1]

        // Check if format includes userId: {campaignShort}U{userShort}
        const userMatch = suffix.match(/^([A-Za-z0-9]+)U([A-Za-z0-9]+)$/)
        if (userMatch) {
            const campaignId = shortToUuid(userMatch[1])
            const userId = shortToUuid(userMatch[2])

            if (!campaignId) return null

            return {
                campaignId,
                userId: userId || undefined,
            }
        }

        // Anonymous donation (no userId)
        const campaignId = shortToUuid(suffix)
        if (!campaignId) return null

        return { campaignId }
    } catch (error) {
        return null
    }
}

/**
 * Clear the encoding cache (useful for testing)
 */
export function clearEncodingCache(): void {
    uuidToShortMap.clear()
    shortToUuidMap.clear()
}
