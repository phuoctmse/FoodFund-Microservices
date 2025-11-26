import { Parent, ResolveField, Resolver } from "@nestjs/graphql"
import {
    WalletSchema,
    UserProfileSchema,
    Badge,
} from "../../../../domain/entities"
import { UserRepository } from "../../../../application/repositories"
import { DataLoaderService } from "../../../../application/services"
import { Role } from "../../../../domain/enums"

@Resolver(() => WalletSchema)
export class WalletFieldResolver {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly dataLoaderService: DataLoaderService,
    ) {}

    @ResolveField(() => UserProfileSchema, {
        description: "Resolve user information for the wallet owner",
        nullable: true,
    })
    async user(@Parent() wallet: WalletSchema): Promise<UserProfileSchema | null> {
        try {
            const user = await this.userRepository.findUserById(wallet.user_id)

            if (!user) {
                return null
            }

            return {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                avatar_url: user.avatar_url,
                address: user.address,
                user_name: user.user_name,
                is_active: user.is_active,
                role: user.role,
                phone_number: user.phone_number,
                bio: user.bio,
                created_at: user.created_at,
                updated_at: user.updated_at,
            } as UserProfileSchema
        } catch (error) {
            return null
        }
    }

    @ResolveField(() => Badge, {
        description: "Resolve badge for DONOR wallet based on donation amount",
        nullable: true,
    })
    async badge(@Parent() wallet: WalletSchema): Promise<Badge | null> {
        try {
            // Get user to check role
            const user = await this.userRepository.findUserById(wallet.user_id)

            // Only DONOR role can have badges
            if (!user || user.role !== Role.DONOR) {
                return null
            }

            // Use DataLoader to efficiently fetch badge
            return this.dataLoaderService.getUserBadge(user.id)
        } catch (error) {
            return null
        }
    }
}
