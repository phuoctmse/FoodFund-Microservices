import { BullModule } from "@nestjs/bull"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { envConfig } from "@libs/env"
import { BullDatadogService } from "./bull-datadog.service"
import { PostLikeQueue } from "./post-like.queue"
import { QUEUE_NAMES } from "./constants"

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
                    },
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: {
                            type: "exponential",
                            delay: 2000,
                        },
                        removeOnComplete: 100,
                        removeOnFail: 50,
                    },
                }
            },
        }),
        BullModule.registerQueue(
            { name: QUEUE_NAMES.POST_LIKES },
            { name: QUEUE_NAMES.DONATIONS },
        ),
    ],
    providers: [BullDatadogService, PostLikeQueue],
    exports: [BullModule, BullDatadogService, PostLikeQueue],
})
export class QueueModule {}
