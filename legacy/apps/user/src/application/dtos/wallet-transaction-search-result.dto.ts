import { Field, Int, ObjectType } from "@nestjs/graphql"
import { WalletTransactionSchema } from "../../domain/entities"

@ObjectType()
export class WalletTransactionSearchResult {
    @Field(() => [WalletTransactionSchema])
        items: WalletTransactionSchema[]

    @Field(() => Int)
        total: number

    @Field(() => Int)
        page: number

    @Field(() => Int)
        limit: number

    @Field(() => Int)
        totalPages: number
}
