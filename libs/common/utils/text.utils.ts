/**
 * Remove Vietnamese diacritics (accents) from text
 * Example: "Góp Gạo Nuôi Người Nghèo" → "Gop Gao Nuoi Nguoi Ngheo"
 */
export function removeVietnameseTones(str: string): string {
    if (!str) return ""

    // Normalize to NFD (decomposed form) then remove combining diacritical marks
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    // Replace special Vietnamese characters
    str = str.replace(/đ/g, "d").replace(/Đ/g, "D")

    return str
}

/**
 * Smart truncate text to fit within maxLength, ensuring complete words
 * If truncation would cut a word, removes the incomplete word
 *
 * Example:
 * - smartTruncate("CS8DJBKI3B7 Gop Gao Nuoi Nguoi", 25) → "CS8DJBKI3B7 Gop Gao"
 * - smartTruncate("CS8DJBKI3B7 Gop Gao", 25) → "CS8DJBKI3B7 Gop Gao"
 */
export function smartTruncate(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
        return text
    }

    // Truncate to maxLength
    let truncated = text.substring(0, maxLength)

    // Find the last space to avoid cutting words
    const lastSpaceIndex = truncated.lastIndexOf(" ")

    // If there's a space and it's not at the very beginning
    if (lastSpaceIndex > 0) {
        // Cut at the last complete word
        truncated = truncated.substring(0, lastSpaceIndex)
    }

    return truncated.trim()
}

/**
 * Prepare campaign title for payment description
 * - Removes Vietnamese tones
 * - Smart truncates to fit within available space
 *
 * @param orderCode - The order code prefix (e.g., "CS8DJBKI3B7")
 * @param campaignTitle - The campaign title
 * @param maxLength - Maximum total length (default: 25 for PayOS)
 * @returns Formatted description
 */
export function formatPaymentDescription(
    orderCode: string,
    campaignTitle: string,
    maxLength: number = 25,
): string {
    // Remove Vietnamese tones
    const normalizedTitle = removeVietnameseTones(campaignTitle)

    // Calculate available space for title (orderCode + space)
    const availableSpace = maxLength - orderCode.length - 1

    // If title fits, use it as is
    if (normalizedTitle.length <= availableSpace) {
        return `${orderCode} ${normalizedTitle}`
    }

    // Smart truncate the title to fit
    const truncatedTitle = smartTruncate(normalizedTitle, availableSpace)

    return `${orderCode} ${truncatedTitle}`
}
