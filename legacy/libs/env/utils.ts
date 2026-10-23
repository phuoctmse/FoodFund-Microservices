export function getEnvVar(key: string, defaultValue?: string): string {
    return process.env[key] || defaultValue || ""
}

export function getEnvNumber(key: string, defaultValue = 0): number {
    const value = process.env[key]
    if (!value) return defaultValue
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? defaultValue : parsed
}

export function getEnvBoolean(key: string, defaultValue = false): boolean {
    const value = process.env[key]
    if (!value) return defaultValue
    return value.toLowerCase() === "true"
}
