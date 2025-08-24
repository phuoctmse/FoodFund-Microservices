import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { CampaignModel, CreateCampaignInput, UpdateCampaignInput, CampaignWithRelations } from '../campaign.model';

@Injectable()
export class CampaignRepository extends BaseRepository<CampaignModel> {
  getModelName(): string {
    return 'campaign';
  }

  async findActiveCampaigns(): Promise<CampaignModel[]> {
    return this.getModel().findMany({
      where: { 
        isActive: true,
        endDate: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCreator(creatorId: string): Promise<CampaignModel[]> {
    return this.getModel().findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(data: CreateCampaignInput): Promise<CampaignModel> {
    return this.create(data);
  }

  async updateCampaign(id: string, data: UpdateCampaignInput): Promise<CampaignModel> {
    return this.update(id, data);
  }

  async findWithDetails(id: string): Promise<CampaignWithRelations | null> {
    return this.getModel().findUnique({
      where: { id },
      include: {
        creator: true,
        donations: {
          include: {
            donor: true,
          },
        },
        comments: {
          include: {
            author: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async updateRaisedAmount(id: string, amount: number): Promise<CampaignModel> {
    return this.getModel().update({
      where: { id },
      data: {
        raised: {
          increment: amount,
        },
      },
    });
  }

  async searchCampaigns(query: string): Promise<CampaignModel[]> {
    return this.getModel().findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
        isActive: true,
        endDate: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findExpiredCampaigns(): Promise<CampaignModel[]> {
    return this.getModel().findMany({
      where: {
        endDate: { lt: new Date() },
        isActive: true,
      },
    });
  }
}
