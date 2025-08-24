import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { UserModel, CreateUserInput, UpdateUserInput, UserWithRelations } from '../user.model';

@Injectable()
export class UserRepository extends BaseRepository<UserModel> {
  getModelName(): string {
    return 'user';
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    return this.getModel().findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string): Promise<UserModel | null> {
    return this.getModel().findUnique({
      where: { username },
    });
  }

  async findActiveUsers(): Promise<UserModel[]> {
    return this.getModel().findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(data: CreateUserInput): Promise<UserModel> {
    return this.getModel().create({
      data,
    });
  }

  async updateUser(id: string, data: UpdateUserInput): Promise<UserModel> {
    return this.update(id, data);
  }

  async softDelete(id: string): Promise<UserModel> {
    return this.update(id, { isActive: false });
  }

  async findWithCampaigns(id: string): Promise<UserWithRelations | null> {
    return this.getModel().findUnique({
      where: { id },
      include: {
        campaigns: true,
        donations: true,
        comments: true,
      },
    });
  }

  async searchUsers(query: string): Promise<UserModel[]> {
    return this.getModel().findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
