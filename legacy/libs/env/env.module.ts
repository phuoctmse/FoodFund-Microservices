import { DynamicModule, Global, Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { EnvModuleOptions } from "./types"
import { envConfig } from "./env.config"

export const ENV_CONFIG = "ENV_CONFIG"

@Global()
@Module({})
export class EnvModule {
    static forRoot(options: EnvModuleOptions = {}): DynamicModule {
        const { isGlobal = true } = options

        return {
            module: EnvModule,
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: [
                        ".env",
                        ".env.local",
                        ".env.development",
                        ".env.docker",
                    ],
                    expandVariables: true,
                }),
            ],
            providers: [
                {
                    provide: ENV_CONFIG,
                    useFactory: () => envConfig(),
                },
            ],
            exports: [ENV_CONFIG],
            global: isGlobal,
        }
    }
}
