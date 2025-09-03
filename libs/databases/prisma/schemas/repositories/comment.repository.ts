import { Injectable } from "@nestjs/common"
import { BaseRepository } from "./base.repository"
import {
    CommentModel,
    CreateCommentInput,
    UpdateCommentInput,
    CommentWithRelations,
} from "../comment.model"

@Injectable()
export class CommentRepository extends BaseRepository<CommentModel> {
    getModelName(): string {
        return "comment"
    }

    async findByCampaign(campaignId: string): Promise<CommentWithRelations[]> {
        return this.getModel().findMany({
            where: { campaignId },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatar: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })
    }

    async findByAuthor(authorId: string): Promise<CommentModel[]> {
        return this.getModel().findMany({
            where: { authorId },
            orderBy: { createdAt: "desc" },
        })
    }

    async createComment(data: CreateCommentInput): Promise<CommentModel> {
        return this.create(data)
    }

    async updateComment(
        id: string,
        data: UpdateCommentInput,
    ): Promise<CommentModel> {
        return this.update(id, data)
    }

    async findWithDetails(id: string): Promise<CommentWithRelations | null> {
        return this.getModel().findUnique({
            where: { id },
            include: {
                author: true,
                campaign: true,
            },
        })
    }

    async getCommentCount(campaignId: string): Promise<number> {
        return this.count({ campaignId })
    }

    async getRecentComments(
        campaignId: string,
        limit: number = 5,
    ): Promise<CommentWithRelations[]> {
        return this.getModel().findMany({
            where: { campaignId },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatar: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        })
    }
}
