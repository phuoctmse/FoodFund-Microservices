import { ConfigurableModuleBuilder } from "@nestjs/common"
import { GraphqlSubgraphOptions } from "./subgraph.types"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<GraphqlSubgraphOptions>()
      .setClassMethodName("forRoot")
      .build()
