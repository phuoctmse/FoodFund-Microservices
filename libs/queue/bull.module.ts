import { envConfig } from "@libs/env"
import { BullModule } from "@nestjs/bull"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

@Module({
    imports: [
        ConfigModule,
        BullModule.forRootAsync({
            useFactory: () => {
                const env = envConfig()
                return {
                    redis: {
                        host: env.redis.host,
                        port: env.redis.port,
                        password: env.redis.password,
                        username: env.redis.username,
                        db: 0,
                        maxRetriesPerRequest: null,
                        enableReadyCheck: false,
                        enableOfflineQueue: true,
                    },
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: {
                            type: "exponential",
                            delay: 2000,
                        },
                        removeOnComplete: 100,
                        removeOnFail: 50,
                        timeout: 30000,
                    },
                }
            },
        }),
    ],
    providers: [],
    exports: [BullModule],
})
export class QueueModule {}