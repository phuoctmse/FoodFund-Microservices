import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class UserHealthResponse {
  @Field()
      status: string

  @Field()
      service: string

  @Field()
      timestamp: string
}
