import { User } from "../../shared"
import { Prisma, PrismaClient } from "../../generated/campaign-client"
import { Injectable, Logger } from "@nestjs/common"
import { PostFilterInput } from "../dtos/post/request"
import { PostSortOrder } from "../../domain/enums/post/post.enum"

export interface FindManyPostsOptions {
    filter?: PostFilterInput
    search?: string
    sortBy?: PostSortOrder
    limit?: number
    offset?: number
}

export interface CreatePostRepositoryInput {
    campaignId: string
    title: string
    content: string
    media?: string
}

export interface UpdatePostRepositoryInput {
    title?: string
    content?: string
    media?: string
}

@Injectable()
export class PostRepository {
    private readonly logger = new Logger(PostRepository.name)

    private readonly POST_INCLUDE = {
        likes: {
            take: 100,
            orderBy: {
                created_at: "desc" as const,
            },
        },
        comments: {
            where: {
                parent_comment_id: null,
            },
            take: 10,
            orderBy: {
                created_at: "desc" as const,
            },
        },
    } as const

    constructor(private readonly prisma: PrismaClient) {}

    async createPost(data: CreatePostRepositoryInput, userId: string) {
        const mediaJson = this.parseMediaToJsonValue(data.media)

        const post = await this.prisma.post.create({
            data: {
                campaign_id: data.campaignId,
                created_by: userId,
                title: data.title,
                content: data.content,
                media: mediaJson,
                like_count: 0,
                comment_count: 0,
                is_active: true,
            },
            include: this.POST_INCLUDE,
        })

        return this.mapToGraphQLModel(post)
    }

    async findPostById(id: string) {
        const post = await this.prisma.post.findUnique({
            where: {
                id,
                is_active: true,
            },
            include: this.POST_INCLUDE,
        })

        return post ? this.mapToGraphQLModel(post) : null
    }

    async findManyPosts(options: FindManyPostsOptions) {
        const {
            filter,
            search,
            sortBy = PostSortOrder.NEWEST_FIRST,
            limit = 10,
            offset = 0,
        } = options

        const whereClause: Prisma.PostWhereInput = {
            is_active: true,
        }

        if (filter?.campaignId) {
            whereClause.campaign_id = filter.campaignId
        }

        if (filter?.creatorId) {
            whereClause.created_by = filter.creatorId
        }

        if (search) {
            whereClause.OR = [
                {
                    title: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    content: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ]
        }

        const posts = await this.prisma.post.findMany({
            where: whereClause,
            include: this.POST_INCLUDE,
            orderBy: this.buildOrderByClause(sortBy),
            take: Math.min(limit, 100),
            skip: offset,
        })

        return posts.map((post) => this.mapToGraphQLModel(post))
    }

    async updatePost(
        id: string,
        data: UpdatePostRepositoryInput,
        userId: string,
    ) {
        const existingPost = await this.prisma.post.findUnique({
            where: { id },
        })

        if (!existingPost) {
            throw new Error("Post not found")
        }

        if (existingPost.created_by !== userId) {
            throw new Error("Unauthorized: You can only edit your own posts")
        }

        const updateData: Prisma.PostUpdateInput = {}

        if (data.title !== undefined) {
            updateData.title = data.title
        }

        if (data.content !== undefined) {
            updateData.content = data.content
        }

        if (data.media !== undefined) {
            updateData.media = this.parseMediaToJsonValue(data.media)
        }

        const post = await this.prisma.post.update({
            where: { id },
            data: updateData,
            include: this.POST_INCLUDE,
        })

        return this.mapToGraphQLModel(post)
    }

    async deletePost(id: string, userId: string): Promise<string> {
        const existingPost = await this.prisma.post.findUnique({
            where: { id },
        })

        if (!existingPost) {
            throw new Error("Post not found")
        }

        if (existingPost.created_by !== userId) {
            throw new Error("Unauthorized: You can only delete your own posts")
        }

        await this.prisma.post.delete({
            where: { id },
        })

        return id
    }

    async deactivatePost(id: string, userId: string) {
        const existingPost = await this.prisma.post.findUnique({
            where: { id },
        })

        if (!existingPost) {
            throw new Error("Post not found")
        }

        if (existingPost.created_by !== userId) {
            throw new Error(
                "Unauthorized: You can only deactivate your own posts",
            )
        }

        const post = await this.prisma.post.update({
            where: { id },
            data: {
                is_active: false,
            },
            include: this.POST_INCLUDE,
        })

        return this.mapToGraphQLModel(post)
    }

    async reactivatePost(id: string, userId: string) {
        const existingPost = await this.prisma.post.findUnique({
            where: { id },
        })

        if (!existingPost) {
            throw new Error("Post not found")
        }

        if (existingPost.created_by !== userId) {
            throw new Error(
                "Unauthorized: You can only reactivate your own posts",
            )
        }

        const post = await this.prisma.post.update({
            where: { id },
            data: {
                is_active: true,
            },
            include: this.POST_INCLUDE,
        })

        return this.mapToGraphQLModel(post)
    }

    async countPosts(
        filter?: PostFilterInput,
        search?: string,
    ): Promise<number> {
        const whereClause: Prisma.PostWhereInput = {
            is_active: true,
        }

        if (filter?.campaignId) {
            whereClause.campaign_id = filter.campaignId
        }

        if (filter?.creatorId) {
            whereClause.created_by = filter.creatorId
        }

        if (search) {
            whereClause.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { content: { contains: search, mode: "insensitive" } },
            ]
        }

        return await this.prisma.post.count({ where: whereClause })
    }

    private parseMediaToJsonValue(
        media?: string,
    ): Prisma.InputJsonValue | undefined {
        if (!media || media.trim() === "") {
            return undefined
        }

        try {
            const parsed = JSON.parse(media)

            if (!Array.isArray(parsed)) {
                this.logger.warn(
                    "Media JSON is not an array, wrapping in array",
                )
                return [parsed] as Prisma.InputJsonValue
            }

            if (parsed.length === 0) {
                return [] as Prisma.InputJsonValue
            }

            return parsed as Prisma.InputJsonValue
        } catch {
            return [media] as Prisma.InputJsonValue
        }
    }

    private buildOrderByClause(
        sortBy: PostSortOrder,
    ): Prisma.PostOrderByWithRelationInput {
        switch (sortBy) {
        case PostSortOrder.OLDEST_FIRST:
            return { created_at: "asc" }
        case PostSortOrder.MOST_LIKED:
            return { like_count: "desc" }
        case PostSortOrder.MOST_COMMENTED:
            return { comment_count: "desc" }
        case PostSortOrder.NEWEST_FIRST:
        default:
            return { created_at: "desc" }
        }
    }

    private mapToGraphQLModel(dbPost: any) {
        const creator: User | undefined = dbPost.created_by
            ? {
                __typename: "User",
                id: dbPost.created_by,
            }
            : undefined

        let mediaString: string | undefined
        if (dbPost.media && dbPost.media !== null) {
            try {
                mediaString =
                    typeof dbPost.media === "string"
                        ? dbPost.media
                        : JSON.stringify(dbPost.media)
            } catch {
                mediaString = undefined
            }
        }

        return {
            id: dbPost.id,
            campaignId: dbPost.campaign_id,
            createdBy: dbPost.created_by,
            title: dbPost.title,
            content: dbPost.content,
            media: mediaString,
            likeCount: dbPost.like_count,
            commentCount: dbPost.comment_count,
            isActive: dbPost.is_active,
            created_at: dbPost.created_at,
            updated_at: dbPost.updated_at,
            creator,
            campaign: undefined,
            isLikedByMe: false,
            likes: dbPost.likes?.map((like: any) => ({
                id: like.id,
                postId: like.post_id,
                userId: like.user_id,
                created_at: like.created_at,
                updated_at: like.created_at,
            })),
            comments: dbPost.comments?.map((comment: any) =>
                this.mapCommentToGraphQLModel(comment),
            ),
        }
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
            created_at: dbComment.created_at,
            updated_at: dbComment.updated_at,
            user,
            post: undefined,
            parentComment: undefined,
            replies: [],
        }
    }
}
