import { AwsCognitoModule } from "@libs/aws-cognito"
import { Module } from "@nestjs/common"
import { CampaignCategoryService } from "./campaign-category.service"
import { CampaignCategoryRepository } from "./campaign-category.repository"
import { CampaignCategoryResolver } from "./campaign-category.resolver"

@Module({
    imports: [
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
    ],
    providers: [
        CampaignCategoryService,
        CampaignCategoryRepository,
        CampaignCategoryResolver,
    ],
    controllers: [],
    exports: [CampaignCategoryService, CampaignCategoryRepository],
})
export class CampaignCategoryModule {}
