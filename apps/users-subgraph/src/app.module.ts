import { Module } from "@nestjs/common"
import { UsersSubgraphModule } from "./users/users-subgraph.module"

@Module({
    imports: [UsersSubgraphModule],
    controllers: [],
    providers: [],
})
export class AppModule {}
