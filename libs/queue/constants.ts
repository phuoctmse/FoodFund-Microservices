export const QUEUE_NAMES = {
    CAMPAIGN_JOBS: "campaign-jobs",
    POST_LIKES: "post-likes",
    DONATIONS: "donations",
    // NOTIFICATIONS: "notifications",
} as const

export const JOB_TYPES = {
    POST_LIKE: "post-like",
    DONATION: "donation",
    NOTIFICATION: "notification",
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]
