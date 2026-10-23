import { envConfig } from "@libs/env"
import { BullModule } from "@nestjs/bull"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { BullDatadogService } from "./bull-datadog.service"
import { QUEUE_NAMES } from "./constants"

@Module({
    imports: [
        ConfigModule,
        BullModule.forRootAsync({
            useFactory: () => {
                const env = envConfig()
                const redisConfig: any = {
                    host: env.redis.host,
                    port: env.redis.port,
                    db: env.nodeEnv === "development" ? 1 : 0,
                    enableOfflineQueue: true,
                    retryStrategy: (times: number) => {
                        if (times > 3) {
                            return null
                        }
                        return Math.min(times * 1000, 3000)
                    },
                    connectTimeout: 10000,
                }

                if (env.redis.password) {
                    redisConfig.password = env.redis.password
                }
                if (env.redis.username) {
                    redisConfig.username = env.redis.username
                }

                if (env.redis.host.includes("digitalocean")) {
                    redisConfig.tls = {
                        rejectUnauthorized: false,
                    }
                }

                return {
                    redis: redisConfig,
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
        BullModule.registerQueue(
            { name: QUEUE_NAMES.POST_LIKES },
            { name: QUEUE_NAMES.CAMPAIGN_JOBS },
        ),
    ],
    providers: [BullDatadogService],
    exports: [BullModule, BullDatadogService],
})
export class QueueModule {}