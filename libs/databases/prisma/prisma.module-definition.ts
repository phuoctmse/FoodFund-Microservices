import { ConfigurableModuleBuilder } from "@nestjs/common";
import { PrismaModuleOptions } from "./prisma.types";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PrismaModuleOptions>()
        .setClassMethodName("forRoot")
        .build();