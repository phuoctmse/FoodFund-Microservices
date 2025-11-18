export const QUEUE_NAMES = {
    POST_LIKES: "post-likes",
    DONATIONS: "donations",
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]
