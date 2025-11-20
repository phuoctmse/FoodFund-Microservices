import { Parent, ResolveField, Resolver } from "@nestjs/graphql"
import { WalletModel } from "../../models/wallet.model"
import { UserProfileSchema } from "../../../../domain/entities/user.model"
import { UserRepository } from "../../../../application/repositories"

@Resolver(() => WalletModel)
export class WalletFieldResolver {
    constructor(private readonly userRepository: UserRepository) {}

    @ResolveField(() => UserProfileSchema, {
        description: "Resolve user information for the wallet owner",
        nullable: true,
    })
    async user(@Parent() wallet: WalletModel): Promise<UserProfileSchema | null> {
        try {
            const user = await this.userRepository.findUserById(wallet.userId)

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
}
