import { Comment as PrismaComment } from '@prisma/client';

export interface CommentModel extends PrismaComment {}

export interface CreateCommentInput {
  content: string;
  authorId: string;
  campaignId: string;
}

export interface UpdateCommentInput {
  content?: string;
}

export interface CommentWithRelations extends CommentModel {
  author?: any;
  campaign?: any;
}
