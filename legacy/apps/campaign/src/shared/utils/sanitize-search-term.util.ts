export function sanitizeSearchTerm(search: string): string {
    if (!search || typeof search !== "string") {
        return ""
    }

    return search
        .trim()
        .replace(/[%_\\]/g, "\\$&")
        .replace(/['";]/g, "")
        .slice(0, 100)
}
