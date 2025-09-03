import { ObjectType, Field } from "@nestjs/graphql"
import { AbstractSchema } from "./abstract.schema"
import { User as PrismaUser } from "@prisma/client"

@ObjectType({
    description: "User schema for FoodFund application",
})
export class UserSchema extends AbstractSchema {
  @Field(() => String, {
      description: "User email address",
  })
      email: string

  @Field(() => String, {
      description: "Unique username",
  })
      username: string

  @Field(() => String, {
      description: "User's full name",
  })
      name: string

  @Field(() => String, {
      nullable: true,
      description: "User's phone number",
  })
      phone?: string

  @Field(() => String, {
      nullable: true,
      description: "User's avatar URL",
  })
      avatar?: string

  @Field(() => String, {
      nullable: true,
      description: "User's bio/description",
  })
      bio?: string

  @Field(() => Boolean, {
      description: "Whether the user is active",
      defaultValue: true,
  })
      isActive: boolean
}

// Prisma model interface (for type safety with database operations)
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
