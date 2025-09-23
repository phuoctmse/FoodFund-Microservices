import { Module } from "@nestjs/common"
import { AdminGuard } from "./guards/admin.guard"
import { GrpcModule } from "libs/grpc"

@Module({
    imports: [GrpcModule],
    providers: [AdminGuard],
    exports: [AdminGuard],
})
export class AuthLibModule {}