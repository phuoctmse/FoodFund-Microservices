import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/campaign-client"
import { User } from "../../shared"
import { CreateCommentInput, UpdateCommentInput } from "../dtos/post/request"

@Injectable()
export class PostCommentRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createComment(data: CreateCommentInput, userId: string) {
        let commentPath = ""
        let depth = 0

        if (data.parentCommentId) {
            const parentComment = await this.prisma.post_Comment.findUnique({
                where: {
                    id: data.parentCommentId,
                    is_active: true,
                },
                select: { comment_path: true, depth: true },
            })

            if (parentComment) {
                commentPath = parentComment.comment_path
                    ? `${parentComment.comment_path}/${data.parentCommentId}`
                    : data.parentCommentId
                depth = parentComment.depth + 1
            }
        }

        const [comment] = await this.prisma.$transaction([
            this.prisma.post_Comment.create({
                data: {
                    post_id: data.postId,
                    user_id: userId,
                    content: data.content,
                    parent_comment_id: data.parentCommentId || null,
                    comment_path: commentPath || null,
                    depth,
                    is_active: true,
                },
            }),
            this.prisma.post.update({
                where: { id: data.postId },
                data: {
                    comment_count: {
                        increment: 1,
                    },
                },
            }),
        ])

        return this.mapCommentToGraphQLModel(comment)
    }

    async findCommentsByPostId(
        postId: string,
        limit: number,
        offset: number,
    ) {
        const allComments = await this.prisma.post_Comment.findMany({
            where: {
                post_id: postId,
                is_active: true,
            },
            orderBy: [{ depth: "asc" }, { created_at: "asc" }],
        })

        const commentMap = new Map<string, any>()
        allComments.forEach((comment) => {
            const mapped = this.mapCommentToGraphQLModel(comment)
            mapped.replies = []
            commentMap.set(comment.id, mapped)
        })

        const topLevelComments: any[] = []
        allComments.forEach((comment) => {
            const mapped = commentMap.get(comment.id)!
            if (comment.parent_comment_id) {
                const parent = commentMap.get(comment.parent_comment_id)
                if (parent) {
                    parent.replies.push(mapped)
                }
            } else {
                topLevelComments.push(mapped)
            }
        })

        return topLevelComments
            .toSorted((a, b) => b.created_at.getTime() - a.created_at.getTime())
            .slice(offset, offset + limit)
    }

    async findCommentById(commentId: string) {
        const comment = await this.prisma.post_Comment.findUnique({
            where: {
                id: commentId,
                is_active: true,
            },
        })

        if (!comment) {
            return null
        }

        return this.mapCommentToGraphQLModel(comment)
    }

    async updateComment(commentId: string, data: UpdateCommentInput) {
        const comment = await this.prisma.post_Comment.update({
            where: {
                id: commentId,
                is_active: true,
            },
            data: {
                content: data.content,
                updated_at: new Date(),
            },
        })

        return this.mapCommentToGraphQLModel(comment)
    }

    async deleteComment(commentId: string, postId: string): Promise<number> {
        const repliesCount = await this.prisma.post_Comment.count({
            where: {
                parent_comment_id: commentId,
                is_active: true,
            },
        })

        const totalDeleted = 1 + repliesCount

        await this.prisma.$transaction([
            this.prisma.post_Comment.update({
                where: { id: commentId },
                data: { is_active: false },
            }),
            this.prisma.post_Comment.updateMany({
                where: {
                    parent_comment_id: commentId,
                    is_active: true,
                },
                data: { is_active: false },
            }),
            this.prisma.post.update({
                where: { id: postId },
                data: {
                    comment_count: {
                        decrement: totalDeleted,
                    },
                },
            }),
        ])

        return totalDeleted
    }

    async getCommentCount(postId: string): Promise<number> {
        return await this.prisma.post_Comment.count({
            where: {
                post_id: postId,
                is_active: true,
            },
        })
    }

    private mapCommentToGraphQLModel(dbComment: any) {
        const user: User | undefined = dbComment.user_id
            ? {
                __typename: "User",
                id: dbComment.user_id,
            }
            : undefined

        return {
            id: dbComment.id,
            postId: dbComment.post_id,
            userId: dbComment.user_id,
            content: dbComment.content,
            parentCommentId: dbComment.parent_comment_id,
            commentPath: dbComment.comment_path,
            depth: dbComment.depth,
            isActive: dbComment.is_active,
            created_at: dbComment.created_at,
            updated_at: dbComment.updated_at,
            user,
            post: undefined,
            parentComment: undefined,
            replies: [],
        }
    }
}
