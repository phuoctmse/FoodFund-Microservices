import { ConfigurableModuleBuilder } from "@nestjs/common"
import { JwtOptions } from "./jwt.types"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<JwtOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({
            ...definition,
            global: extras.isGlobal,
        }))
        .build()
