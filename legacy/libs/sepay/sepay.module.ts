import { Module } from "@nestjs/common"
import { SepayService } from "./sepay.service"

@Module({
    providers: [SepayService],
    exports: [SepayService],
})
export class SepayModule {}
