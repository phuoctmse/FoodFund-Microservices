import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { SqsService } from "./aws-sqs.service"

@Module({
    imports: [ConfigModule],
    providers: [SqsService],
    exports: [SqsService],
})
export class SqsModule {}
