import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./payos.module-definition"
import { PayOSService } from "./payos.service"

@Module({
    providers: [PayOSService],
    exports: [PayOSService],
})
export class PayOSModule extends ConfigurableModuleClass {}