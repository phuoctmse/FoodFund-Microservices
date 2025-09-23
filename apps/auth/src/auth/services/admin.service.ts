import { Injectable, Logger } from "@nestjs/common"
import {
    AuthUser,
    CreateStaffAccountResponse,
    CreateFundraiserAccountResponse,
} from "../models"
import {
    CreateStaffAccountInput,
    CreateFundraiserAccountInput,
} from "../dto"
import { AuthAdminService } from "./auth-admin.service"

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name)

    constructor(
        private readonly authAdminService: AuthAdminService,
    ) {}

    async createFundraiserAccount(
        input: CreateFundraiserAccountInput,
        adminUser: AuthUser,
    ): Promise<CreateFundraiserAccountResponse> {
        return this.authAdminService.createFundraiserAccount(input, adminUser)
    }

    async createStaffAccount(
        input: CreateStaffAccountInput,
        adminUser: AuthUser,
    ): Promise<CreateStaffAccountResponse> {
        return this.authAdminService.createStaffAccount(input, adminUser)
    }
}