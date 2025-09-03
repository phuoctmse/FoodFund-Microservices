import { ObjectType, Field } from "@nestjs/graphql"
import { AbstractSchema } from "./abstract.schema"
import { Comment as PrismaComment } from "@prisma/client"

@ObjectType({
    description: "Comment schema for campaign comments",
})
export class CommentSchema extends AbstractSchema {
  @Field(() => String, {
      description: "Comment content",
  })
      content: string

  @Field(() => String, {
      description: "ID of the comment author",
  })
      authorId: string

  @Field(() => String, {
      description: "ID of the campaign",
  })
      campaignId: string
}

// Prisma model interface (for type safety with database operations)
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
