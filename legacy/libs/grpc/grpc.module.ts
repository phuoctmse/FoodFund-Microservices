import { Module, Global } from "@nestjs/common"
import { GrpcClientService } from "./grpc-client.service"
import { GrpcServerService } from "./grpc-server.service"

@Global()
@Module({
    providers: [GrpcClientService, GrpcServerService],
    exports: [GrpcClientService, GrpcServerService],
})
export class GrpcModule {}
