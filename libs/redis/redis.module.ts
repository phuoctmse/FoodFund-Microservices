import { DynamicModule, Global, Module } from "@nestjs/common"
import {
    ConfigurableModuleClass,
    MODULE_OPTIONS_TOKEN,
} from "./redis.module-definition"
import { RedisService } from "./redis.service"
import type { RedisModuleOptions } from "./redis.types"
import { envConfig } from "@libs/env"

@Global()
@Module({})
export class RedisModule extends ConfigurableModuleClass {
    static registerAsync(): DynamicModule {
        const env = envConfig()

        return this.forRoot({
            host: env.redis.host,
            port: env.redis.port,
            password: env.redis.password,
            username: env.redis.username,
        })
    }

    static forRoot(options: RedisModuleOptions): DynamicModule {
        const dynamicModule = super.forRoot(options)

        return {
            global: true,
            ...dynamicModule,
            providers: [
                {
                    provide: MODULE_OPTIONS_TOKEN,
                    useValue: options,
                },
                RedisService,
            ],
            exports: [RedisService],
        }
    }
}
