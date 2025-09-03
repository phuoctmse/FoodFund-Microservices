import { Module } from "@nestjs/common"
import { AuthSubgraphModule } from "./auth/auth-subgraph.module"
import { EnvModule } from "libs/env"

@Module({
    imports: [EnvModule.forRoot(), AuthSubgraphModule],
    controllers: [],
    providers: [],
})
export class AppModule {}
