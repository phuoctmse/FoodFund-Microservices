import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { EnvModule } from "libs/env"
import { PrismaModule } from "libs/databases/prisma"
import { UserSubgraphModule } from "./user/user-subgraph.module"

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: [".env", ".env.local"],
        }),
        EnvModule.forRoot(),
        PrismaModule.forRoot({
            isGlobal: true,
            enableLogging: true,
            logLevel: process.env.NODE_ENV === "development" 
                ? ["query", "info", "warn", "error"] 
                : ["error"],
            datasourceUrl: process.env.USERS_DATABASE_URL,
        }),
        UserSubgraphModule
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
