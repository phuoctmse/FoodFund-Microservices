import { Module } from "@nestjs/common"
import { EnvModule } from "libs/env"

@Module({
    imports: [EnvModule.forRoot()],
    controllers: [],
    providers: [],
})
export class AppModule {}
