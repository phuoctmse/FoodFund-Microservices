import * as DataLoader from "dataloader"
import { Injectable, Scope } from "@nestjs/common"
import { UserClientService } from "../services/user-client.service"

export interface UserData {
    id: string
    fullName?: string
    username?: string
}

@Injectable({ scope: Scope.REQUEST })
export class UserDataLoader {
    private readonly loader: DataLoader<string, UserData | null>

    constructor(private readonly userClientService: UserClientService) {
        this.loader = new DataLoader<string, UserData | null>(
            async (userIds: readonly string[]) => {
                return this.batchLoadUsers(userIds as string[])
            },
            {
                cache: true, // Enable caching within the same request
                maxBatchSize: 100, // Limit batch size
            },
        )
    }

    private async batchLoadUsers(
        userIds: string[],
    ): Promise<(UserData | null)[]> {
        // Fetch all users in parallel
        const userPromises = userIds.map((userId) =>
            this.userClientService.getUserById(userId).catch(() => null),
        )

        const users = await Promise.all(userPromises)

        // Return in the same order as requested
        return users.map((user) =>
            user
                ? {
                    id: user.id,
                    fullName: user.fullName,
                    username: user.username,
                }
                : null,
        )
    }

    async load(userId: string): Promise<UserData | null> {
        return this.loader.load(userId)
    }

    async loadMany(userIds: string[]): Promise<(UserData | null)[]> {
        return this.loader.loadMany(userIds) as Promise<(UserData | null)[]>
    }

    async getUserName(userId: string): Promise<string | null> {
        const user = await this.load(userId)
        return user?.fullName || user?.username || null
    }
}
