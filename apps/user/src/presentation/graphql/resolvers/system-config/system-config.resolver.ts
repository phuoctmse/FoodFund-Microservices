import { Resolver, Query, Mutation, Args } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { RequireRole } from "@libs/auth"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { Role } from "@libs/databases"
import { SystemConfigService } from "../../../../application/services/system-config/system-config.service"
import { SystemConfig } from "../../../../domain/entities/system-config.model"
import { UpdateSystemConfigInput } from "../../../../application/dtos/system-config.input"
import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class DeleteSystemConfigResponse {
    @Field()
        success: boolean

    @Field()
        message: string
}

@Resolver()
@UseGuards(CognitoGraphQLGuard)
export class SystemConfigResolver {
    constructor(private readonly systemConfigService: SystemConfigService) { }

    @Query(() => [SystemConfig], { name: "getSystemConfigs" })
    @RequireRole(Role.ADMIN)
    async getSystemConfigs(): Promise<SystemConfig[]> {
        const configs = await this.systemConfigService.getAllConfigs()
        return configs.map((config) => ({
            ...config,
            description: config.description ?? undefined,
        }))
    }

    @Query(() => SystemConfig, { name: "getSystemConfig", nullable: true })
    @RequireRole(Role.ADMIN)
    async getSystemConfig(
        @Args("key") key: string,
    ): Promise<SystemConfig | null> {
        const config = await this.systemConfigService.getConfig(key)
        if (!config) return null
        return {
            ...config,
            description: config.description ?? undefined,
        }
    }

    @Mutation(() => SystemConfig, { name: "updateSystemConfig" })
    @RequireRole(Role.ADMIN)
    async updateSystemConfig(
        @Args("input") input: UpdateSystemConfigInput,
    ): Promise<SystemConfig> {
        const config = await this.systemConfigService.updateConfig({
            key: input.key,
            value: input.value,
            description: input.description,
            dataType: input.dataType,
        })
        return {
            ...config,
            description: config.description ?? undefined,
        }
    }

    @Mutation(() => DeleteSystemConfigResponse, { name: "deleteSystemConfig" })
    @RequireRole(Role.ADMIN)
    async deleteSystemConfig(
        @Args("key") key: string,
    ): Promise<DeleteSystemConfigResponse> {
        const success = await this.systemConfigService.deleteConfig(key)
        return {
            success,
            message: success
                ? `Config "${key}" đã được xóa thành công`
                : `Không thể xóa config "${key}". Config không tồn tại hoặc đã xảy ra lỗi`,
        }
    }
}
