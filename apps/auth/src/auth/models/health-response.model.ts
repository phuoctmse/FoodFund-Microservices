import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class HealthResponse {
  @Field()
      status: string

  @Field()
      service: string

  @Field()
      timestamp: string
}
