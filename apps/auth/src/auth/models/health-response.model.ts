import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class AuthHealthResponse {
  @Field()
      status: string

  @Field()
      service: string

  @Field()
      timestamp: string
}
