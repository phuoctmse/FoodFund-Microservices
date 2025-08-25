import { DynamicModule, Global, Module } from '@nestjs/common';
import { EnvModuleOptions, EnvironmentConfig } from './types';
import { parseEnvConfig } from './env.config';

export const ENV_CONFIG = 'ENV_CONFIG';

@Global()
@Module({})
export class EnvModule {
  static forRoot(options: EnvModuleOptions = {}): DynamicModule {
    const { isGlobal = true } = options;
    const config = parseEnvConfig();

    const providers = [
      {
        provide: ENV_CONFIG,
        useValue: config,
      },
    ];

    const moduleDefinition: DynamicModule = {
      module: EnvModule,
      providers,
      exports: [ENV_CONFIG],
    };

    return isGlobal ? {
      ...moduleDefinition,
      global: true,
    } : moduleDefinition;
  }
}
