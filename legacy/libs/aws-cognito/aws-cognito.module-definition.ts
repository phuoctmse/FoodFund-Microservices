import { ConfigurableModuleBuilder } from "@nestjs/common"
import { AwsCognitoModuleOptions } from "./aws-cognito.types"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AwsCognitoModuleOptions>()
        .setClassMethodName("forRoot")
        .setExtras(
            {
                isGlobal: false,
            },
            (definition, extras) => ({
                ...definition,
                global: extras.isGlobal,
            }),
        )
        .build()
