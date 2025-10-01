import { BuildSchemaOptions } from "@nestjs/graphql"

export interface GraphqlSubgraphOptions {
    federationVersion?: number
    debug?: boolean
    playground?: boolean
    path?: string
    buildSchemaOptions?: BuildSchemaOptions
}
