import { User as PrismaUser } from '@prisma/client';

export interface UserModel extends PrismaUser {}

export interface CreateUserInput {
  email: string;
  username: string;
  name: string;
  phone?: string;
  bio?: string;
}

export interface UpdateUserInput {
  email?: string;
  username?: string;
  name?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  isActive?: boolean;
}

export interface UserWithRelations extends UserModel {
  campaigns?: any[];
  donations?: any[];
  comments?: any[];
}
