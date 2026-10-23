import { Directive, Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType("CampaignPhase")
@Directive("@key(fields: \"id\")")
export class CampaignPhase {
    @Field(() => ID)
        id: string

    __typename?: string
}
