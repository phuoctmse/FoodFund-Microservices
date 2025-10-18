import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RedisModuleOptions } from "./redis.types"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
    new ConfigurableModuleBuilder<RedisModuleOptions>()
        .setClassMethodName("forRoot")
        .setFactoryMethodName("createRedisOptions")
        .setExtras(
            {
                isGlobal: true,
            },
            (definition, extras) => ({
                ...definition,
                global: extras.isGlobal,
            }),
        )
        .build()