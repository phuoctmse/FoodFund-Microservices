import { Module, Global } from "@nestjs/common"
import { VietQRService } from "./vietqr.service"

@Global()
@Module({
    providers: [VietQRService],
    exports: [VietQRService],
})
export class VietQRModule {}
