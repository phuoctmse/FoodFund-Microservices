import { Logger } from "@nestjs/common"

const logger = new Logger("HtmlSanitizer")

export function stripHtmlTags(
    html: string,
    options: {
        maxLength?: number
        allowedTags?: string[]
        timeout?: number
    } = {},
): string {
    const { maxLength = 100000, allowedTags = [], timeout = 100 } = options

    if (!html || typeof html !== "string") {
        return ""
    }

    if (html.length > maxLength) {
        logger.warn(
            `HTML content exceeds max length (${html.length} > ${maxLength}), truncating`,
        )
        html = html.slice(0, maxLength)
    }

    const startTime = Date.now()

    try {
        let result = html

        result = result.replaceAll(/<!--[\s\S]*?-->/g, "")
        result = result.replaceAll(
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            "",
        )
        result = result.replaceAll(
            /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
            "",
        )

        if (Date.now() - startTime > timeout) {
            logger.error("HTML stripping timeout exceeded")
            throw new Error("HTML processing timeout")
        }

        const parts = result.split("<")
        result = parts
            .map((part) => {
                const gtIndex = part.indexOf(">")
                if (gtIndex === -1) {
                    return part
                }

                const tagContent = part.slice(0, gtIndex)
                const textContent = part.slice(gtIndex + 1)

                if (allowedTags.length > 0) {
                    const tagName = tagContent.split(/\s/)[0].toLowerCase()
                    if (allowedTags.includes(tagName)) {
                        return `<${part}`
                    }
                }

                return textContent
            })
            .join("")

        result = decodeHtmlEntities(result)
        result = result.replaceAll(/\s+/g, " ").trim()

        return result
    } catch (error) {
        logger.error("Error stripping HTML tags:", error)
        return ""
    }
}

function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": "\"",
        "&#39;": "'",
        "&nbsp;": " ",
        "&apos;": "'",
    }

    return text.replaceAll(/&[#\w]+;/g, (entity) => entities[entity] || entity)
}

export function sanitizeHtml(
    html: string,
    options: {
        allowedTags?: string[]
        allowedAttributes?: Record<string, string[]>
        maxLength?: number
    } = {},
): string {
    const {
        allowedTags = ["p", "br", "strong", "em", "u", "a", "ul", "ol", "li"],
        allowedAttributes = { a: ["href", "title"] },
        maxLength = 100000,
    } = options

    if (!html || typeof html !== "string") {
        return ""
    }

    if (html.length > maxLength) {
        logger.warn(
            `HTML content exceeds max length (${html.length} > ${maxLength}), truncating`,
        )
        html = html.slice(0, maxLength)
    }

    try {
        let result = html
            .replaceAll(
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                "",
            )
            .replaceAll(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")

        result = result.replaceAll(/\son\w+\s*=\s*["'][^"']*["']/gi, "")

        const parts = result.split("<")
        result = parts
            .map((part, index) => {
                if (index === 0) return part

                const gtIndex = part.indexOf(">")
                if (gtIndex === -1) return part

                const tagContent = part.slice(0, gtIndex)
                const textContent = part.slice(gtIndex + 1)

                const isClosingTag = tagContent.startsWith("/")
                const tagName = (
                    isClosingTag ? tagContent.slice(1) : tagContent
                )
                    .split(/\s/)[0]
                    .toLowerCase()

                if (!allowedTags.includes(tagName)) {
                    return textContent
                }

                if (!isClosingTag && allowedAttributes[tagName]) {
                    const attrs = tagContent.slice(tagName.length).trim()
                    const allowedAttrs = allowedAttributes[tagName]

                    const filteredAttrs = attrs
                        .split(/\s+/)
                        .filter((attr) => {
                            const attrName = attr.split("=")[0].toLowerCase()
                            return allowedAttrs.includes(attrName)
                        })
                        .join(" ")

                    return `<${tagName}${filteredAttrs ? " " + filteredAttrs : ""}>${textContent}`
                }

                return `<${tagContent}>${textContent}`
            })
            .join("")

        return result.trim()
    } catch (error) {
        logger.error("Error sanitizing HTML:", error)
        return stripHtmlTags(html)
    }
}

export function truncateHtml(
    html: string,
    maxLength: number,
    suffix: string = "...",
): string {
    const plainText = stripHtmlTags(html)

    if (plainText.length <= maxLength) {
        return html
    }

    let charCount = 0
    let truncateIndex = 0

    for (let i = 0; i < html.length; i++) {
        if (html[i] === "<") {
            const closeIndex = html.indexOf(">", i)
            if (closeIndex !== -1) {
                continue
            }
        }

        charCount++
        if (charCount >= maxLength) {
            truncateIndex = i + 1
            break
        }
    }

    return html.slice(0, truncateIndex) + suffix
}
