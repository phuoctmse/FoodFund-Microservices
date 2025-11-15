import { Field, InputType } from "@nestjs/graphql"
import { IsEnum, IsOptional, IsString } from "class-validator"
import { InflowTransactionStatus, InflowTransactionType } from "../../../domain/enums"

@InputType()
export class InflowTransactionFilterInput {
        @Field(() => String, { nullable: true })
        @IsOptional()
        @IsString()
            campaignPhaseId?: string

        @Field(() => String, { nullable: true })
        @IsOptional()
        @IsString()
            receiverId?: string

        @Field(() => InflowTransactionType, { nullable: true })
        @IsOptional()
        @IsEnum(InflowTransactionType)
            transactionType?: InflowTransactionType

        @Field(() => InflowTransactionStatus, { nullable: true })
        @IsOptional()
        @IsEnum(InflowTransactionStatus)
            status?: InflowTransactionStatus

        @Field(() => Date, { nullable: true })
        @IsOptional()
            fromDate?: Date

        @Field(() => Date, { nullable: true })
        @IsOptional()
            toDate?: Date
}

@InputType()
export class MyInflowTransactionFilterInput {
        @Field(() => String, { nullable: true })
        @IsOptional()
        @IsString()
            campaignPhaseId?: string

        @Field(() => String, { nullable: true })
        @IsOptional()
        @IsEnum(InflowTransactionType)
            transactionType?: InflowTransactionType

        @Field(() => String, { nullable: true })
        @IsOptional()
        @IsEnum(InflowTransactionStatus)
            status?: InflowTransactionStatus

        @Field(() => Date, { nullable: true })
        @IsOptional()
            fromDate?: Date

        @Field(() => Date, { nullable: true })
        @IsOptional()
            toDate?: Date
}
