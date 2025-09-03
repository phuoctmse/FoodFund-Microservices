import { ObjectType, Field, Float } from "@nestjs/graphql"
import { AbstractSchema } from "./abstract.schema"
import { Campaign as PrismaCampaign } from "@prisma/client"

@ObjectType({
    description: "Campaign schema for fundraising campaigns",
})
export class CampaignSchema extends AbstractSchema {
  @Field(() => String, {
      description: "Campaign title",
  })
      title: string

  @Field(() => String, {
      description: "Campaign description",
  })
      description: string

  @Field(() => Float, {
      description: "Fundraising goal amount",
  })
      goal: number

  @Field(() => Float, {
      description: "Amount raised so far",
      defaultValue: 0,
  })
      raised: number

  @Field(() => String, {
      nullable: true,
      description: "Campaign image URL",
  })
      imageUrl?: string

  @Field(() => Boolean, {
      description: "Whether the campaign is active",
      defaultValue: true,
  })
      isActive: boolean

  @Field(() => Date, {
      description: "Campaign start date",
  })
      startDate: Date

  @Field(() => Date, {
      description: "Campaign end date",
  })
      endDate: Date

  @Field(() => String, {
      description: "ID of the campaign creator",
  })
      creatorId: string
}

// Prisma model interface (for type safety with database operations)
export interface CampaignModel extends PrismaCampaign {}

export interface CreateCampaignInput {
  title: string;
  description: string;
  goal: number;
  imageUrl?: string;
  endDate: Date;
  creatorId: string;
}

export interface UpdateCampaignInput {
  title?: string;
  description?: string;
  goal?: number;
  imageUrl?: string;
  endDate?: Date;
  isActive?: boolean;
}

export interface CampaignWithRelations extends CampaignModel {
  creator?: any;
  donations?: any[];
  comments?: any[];
}
