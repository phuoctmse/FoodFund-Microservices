import { Donation as PrismaDonation } from '@prisma/client';

export interface DonationModel extends PrismaDonation {}

export interface CreateDonationInput {
  amount: number;
  message?: string;
  isPrivate?: boolean;
  donorId: string;
  campaignId: string;
}

export interface UpdateDonationInput {
  amount?: number;
  message?: string;
  isPrivate?: boolean;
}

export interface DonationWithRelations extends DonationModel {
  donor?: any;
  campaign?: any;
}
