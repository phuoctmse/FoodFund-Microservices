import { ObjectType, Field, Float } from "@nestjs/graphql"
import { AbstractSchema } from "./abstract.schema"
import { Donation as PrismaDonation } from "@prisma/client"

@ObjectType({
    description: "Donation schema for tracking donations",
})
export class DonationSchema extends AbstractSchema {
  @Field(() => Float, {
      description: "Donation amount",
  })
      amount: number

  @Field(() => String, {
      nullable: true,
      description: "Optional message from donor",
  })
      message?: string

  @Field(() => Boolean, {
      description: "Whether the donation is private",
      defaultValue: false,
  })
      isPrivate: boolean

  @Field(() => String, {
      description: "ID of the donor",
  })
      donorId: string

  @Field(() => String, {
      description: "ID of the campaign",
  })
      campaignId: string
}

// Prisma model interface (for type safety with database operations)
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
