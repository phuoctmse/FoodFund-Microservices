import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/campaign-client"
import { User } from "../../shared"

@Injectable()
export class PostLikeRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async likePost(postId: string, userId: string) {
        const [like, updatedPost] = await this.prisma.$transaction([
            this.prisma.post_Like.create({
                data: {
                    post_id: postId,
                    user_id: userId,
                },
            }),
            this.prisma.post.update({
                where: { id: postId },
                data: {
                    like_count: {
                        increment: 1,
                    },
                },
                select: { like_count: true },
            }),
        ])

        return {
            likeId: like.id,
            likeCount: updatedPost.like_count,
        }
    }

    async unlikePost(postId: string, userId: string) {
        const [, updatedPost] = await this.prisma.$transaction([
            this.prisma.post_Like.delete({
                where: {
                    post_id_user_id: {
                        post_id: postId,
                        user_id: userId,
                    },
                },
            }),
            this.prisma.post.update({
                where: { id: postId },
                data: {
                    like_count: {
                        decrement: 1,
                    },
                },
                select: { like_count: true },
            }),
        ])

        return {
            likeCount: updatedPost.like_count,
        }
    }

    async findLikesByUsersAndPosts(
        userIds: string[],
        postIds: string[],
    ): Promise<Array<{ postId: string; userId: string }>> {
        const likes = await this.prisma.post_Like.findMany({
            where: {
                user_id: { in: userIds },
                post_id: { in: postIds },
            },
            select: {
                post_id: true,
                user_id: true,
            },
        })

        return likes.map((like) => ({
            postId: like.post_id,
            userId: like.user_id,
        }))
    }

    async checkIfUserLikedPost(
        postId: string,
        userId: string,
    ): Promise<boolean> {
        const like = await this.prisma.post_Like.findUnique({
            where: {
                post_id_user_id: {
                    post_id: postId,
                    user_id: userId,
                },
            },
        })

        return !!like
    }

    async getPostLikes(postId: string, limit: number, offset: number) {
        const likes = await this.prisma.post_Like.findMany({
            where: {
                post_id: postId,
            },
            orderBy: {
                created_at: "desc",
            },
            take: Math.min(limit, 100),
            skip: offset,
            select: {
                id: true,
                post_id: true,
                user_id: true,
                created_at: true,
            },
        })

        return likes.map((like) => ({
            id: like.id,
            postId: like.post_id,
            userId: like.user_id,
            user: {
                __typename: "User",
                id: like.user_id,
            } as User,
            created_at: like.created_at,
            updated_at: like.created_at,
        }))
    }

    async getLikeCount(postId: string): Promise<number> {
        return await this.prisma.post_Like.count({
            where: {
                post_id: postId,
            },
        })
    }

    async getUserLikedPosts(userId: string, limit: number, offset: number) {
        const likes = await this.prisma.post_Like.findMany({
            where: {
                user_id: userId,
            },
            orderBy: {
                created_at: "desc",
            },
            take: Math.min(limit, 100),
            skip: offset,
            select: {
                post_id: true,
                created_at: true,
            },
        })

        return likes.map((like) => ({
            postId: like.post_id,
            likedAt: like.created_at,
        }))
    }
}
