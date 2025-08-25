import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository, CampaignRepository, DonationRepository } from 'libs/databases';
import { User } from '../models/user.model';

@Injectable()
export class UsersSubgraphService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly donationRepository: DonationRepository,
  ) {}

  private transformUser(user: any): User {
    return {
      ...user,
      phone: user.phone || undefined,
      avatar: user.avatar || undefined,
      bio: user.bio || undefined,
    };
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return this.transformUser(user);
  }

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.findActiveUsers();
    return users.map(user => this.transformUser(user));
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    return user ? this.transformUser(user) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.userRepository.findByUsername(username);
    return user ? this.transformUser(user) : null;
  }

  async createUser(userData: {
    email: string;
    username: string;
    name: string;
    phone?: string;
    bio?: string;
  }): Promise<User> {
    const user = await this.userRepository.createUser(userData);
    return this.transformUser(user);
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const existingUser = await this.findById(id);
    
    const updatedUser = await this.userRepository.updateUser(id, userData);
    return this.transformUser(updatedUser);
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.findById(id); // Check if user exists
    
    await this.userRepository.softDelete(id);

    return true;
  }

  // Ví dụ sử dụng nhiều repository
  async getUserWithCampaigns(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const campaigns = await this.campaignRepository.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return {
      user: this.transformUser(user),
      campaigns
    };
  }

  async getUserDonationStats(userId: string) {
    const user = await this.findById(userId);
    
    const donations = await this.donationRepository.findMany({
      where: { userId }
    });

    const totalDonated = donations.reduce((sum, donation) => sum + donation.amount, 0);
    const donationCount = donations.length;

    return {
      user,
      totalDonated,
      donationCount,
      recentDonations: donations.slice(0, 5)
    };
  }
}
