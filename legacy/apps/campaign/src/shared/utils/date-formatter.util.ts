export function formatDateVietnamese(date: Date): string {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new TypeError("Invalid date provided")
    }

    return date.toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
}

export function formatDateTimeVietnamese(date: Date): string {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new TypeError("Invalid date provided")
    }

    return date.toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })
}

export function formatDateISO(date: Date): string {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new TypeError("Invalid date provided")
    }

    return date.toISOString().split("T")[0]
}