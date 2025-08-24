import { Campaign as PrismaCampaign } from '@prisma/client';

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
