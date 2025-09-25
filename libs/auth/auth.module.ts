import { Module } from "@nestjs/common"
import { GrpcModule } from "libs/grpc"
import { RoleGuard } from "./guards/role.guard"

@Module({
    imports: [GrpcModule],
    providers: [RoleGuard],
    exports: [RoleGuard],
})
export class AuthLibModule {}
