import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'libs/databases';
import { User } from '../models/user.model';

@Injectable()
export class UsersSubgraphService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async createUser(userData: {
    email: string;
    username: string;
    name: string;
    phone?: string;
    bio?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: userData,
    });
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const existingUser = await this.findById(id);
    
    return this.prisma.user.update({
      where: { id },
      data: userData,
    });
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.findById(id); // Check if user exists
    
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return true;
  }
}
