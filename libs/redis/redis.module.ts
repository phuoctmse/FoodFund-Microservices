import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./redis.module-definition"
import { RedisService } from "./redis.service"
import type { RedisModuleOptions } from "./redis.types"
import { envConfig } from "@libs/env"

@Module({
    providers: [RedisService],
    exports: [RedisService],
})
export class RedisModule extends ConfigurableModuleClass {
    static registerAsync() {
        return this.forRootAsync({
            useFactory: (): RedisModuleOptions => {
                const env = envConfig()

                return {
                    host: env.redis.host,
                    port: env.redis.port,
                    password: env.redis.password,
                    username: env.redis.username,
                }
            },
            isGlobal: true,
        })
    }

    static register(options: RedisModuleOptions) {
        return this.forRoot({
            ...options,
            isGlobal: true,
        })
    }
}
