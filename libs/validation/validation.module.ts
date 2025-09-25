import { Module, Global } from "@nestjs/common"
import { CustomValidationPipe } from "./validation.pipe"

@Global()
@Module({
    providers: [CustomValidationPipe],
    exports: [CustomValidationPipe],
})
export class ValidationModule {}
