import { Field, Float, InputType, Int, registerEnumType } from "@nestjs/graphql"
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator"
import { Transaction_Type } from "../../domain/enums/wallet.enum"

export enum WalletTransactionSortBy {
    NEWEST = "NEWEST",
    OLDEST = "OLDEST",
    HIGHEST_AMOUNT = "HIGHEST_AMOUNT",
    LOWEST_AMOUNT = "LOWEST_AMOUNT",
}

registerEnumType(WalletTransactionSortBy, {
    name: "WalletTransactionSortBy",
})

@InputType()
export class SearchWalletTransactionInput {
    @Field(() => String)
    @IsNotEmpty()
    @IsUUID()
        walletId: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        query?: string

    @Field(() => Transaction_Type, { nullable: true })
    @IsOptional()
    @IsEnum(Transaction_Type)
        transactionType?: Transaction_Type

    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
        minAmount?: number

    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
        maxAmount?: number

    @Field(() => Date, { nullable: true })
    @IsOptional()
        startDate?: Date

    @Field(() => Date, { nullable: true })
    @IsOptional()
        endDate?: Date

    @Field(() => WalletTransactionSortBy, { nullable: true })
    @IsOptional()
    @IsEnum(WalletTransactionSortBy)
        sortBy?: WalletTransactionSortBy

    @Field(() => Int, { defaultValue: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
        page: number

    @Field(() => Int, { defaultValue: 10 })
    @IsOptional()
    @IsInt()
    @Min(1)
        limit: number
}
