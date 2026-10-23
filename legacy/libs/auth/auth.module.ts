import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { RoleGuard } from "./guards/role.guard"
import { OptionalJwtAuthGuard } from "./guards/optional-jwt-auth.guard"

@Module({
    imports: [ConfigModule],
    providers: [RoleGuard, OptionalJwtAuthGuard],
    exports: [RoleGuard, OptionalJwtAuthGuard],
})
export class AuthLibModule {}
