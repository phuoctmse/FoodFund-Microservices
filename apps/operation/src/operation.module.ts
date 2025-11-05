import { Module } from "@nestjs/common"
import { OperationController } from "./operation.controller"
import { OperationService } from "./operation.service"

@Module({
    imports: [],
    controllers: [OperationController],
    providers: [OperationService],
})
export class OperationModule {}
