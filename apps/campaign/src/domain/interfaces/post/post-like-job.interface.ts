export enum LikeAction {
    LIKE = "LIKE",
    UNLIKE = "UNLIKE",
}

export interface PostLikeJob {
    action: LikeAction
    postId: string
    userId: string
    timestamp: number
}