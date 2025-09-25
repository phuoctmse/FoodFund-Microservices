import { DynamicModule, Module } from "@nestjs/common"
import { PassportModule } from "@nestjs/passport"
import { AwsCognitoService } from "./aws-cognito.service"
import { CognitoAuthStrategy } from "./strategies/cognito-auth.strategy"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
    MODULE_OPTIONS_TOKEN,
} from "./aws-cognito.module-definition"
import { GuardConstructor } from "./aws-cognito.types"

@Module({})
export class AwsCognitoModule extends ConfigurableModuleClass {
    /**
     * Configure AWS Cognito for root module with authentication setup
     */
    static forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
        const dynamicModule = super.forRoot(options)

        return {
            ...dynamicModule,
            imports: [PassportModule],
            providers: [
                {
                    provide: MODULE_OPTIONS_TOKEN,
                    useValue: options,
                },
                AwsCognitoService,
                CognitoAuthStrategy,
            ],
            exports: [AwsCognitoService, CognitoAuthStrategy],
        }
    }

    /**
     * Configure AWS Cognito for feature modules with specific guards
     */
    static forFeature(guards: GuardConstructor[] = []): DynamicModule {
        return {
            module: AwsCognitoModule,
            providers: [...guards],
            exports: [...guards],
        }
    }
}
