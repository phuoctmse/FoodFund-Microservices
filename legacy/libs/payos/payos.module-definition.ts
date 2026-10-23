import { ConfigurableModuleBuilder } from "@nestjs/common"
import { PayOSConfig } from "./payos.types"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
    new ConfigurableModuleBuilder<PayOSConfig>()
        .setClassMethodName("forRoot")
        .setExtras({ isGlobal: false }, (definition, extras) => ({
            ...definition,
            global: extras.isGlobal,
        }))
        .build()
