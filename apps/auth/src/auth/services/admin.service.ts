import { Injectable, Logger } from "@nestjs/common"
import { AuthUser, CreateStaffAccountResponse } from "../models"
import { CreateStaffAccountInput } from "../dto"
import { AuthAdminService } from "./auth-admin.service"

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name)

    constructor(private readonly authAdminService: AuthAdminService) {}

    async createStaffAccount(
        input: CreateStaffAccountInput,
        adminUser: AuthUser,
    ): Promise<CreateStaffAccountResponse> {
        return this.authAdminService.createStaffAccount(input, adminUser)
    }
}
