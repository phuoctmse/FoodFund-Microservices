import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from "@nestjs/common"
import { WalletRepository } from "../../repositories/wallet.repository"
import { Transaction_Type, Wallet_Type } from "@app/user/src/domain/enums/wallet.enum"

export interface SepayWebhookPayload {
    id: number
    gateway: string
    transactionDate: string
    accountNumber: string
    code: string | null
    content: string
    transferType: string
    transferAmount: number
    accumulated: number
    subAccount: string | null
    referenceCode: string
    description: string
}

@Injectable()
export class WalletTransactionService {
    private readonly logger = new Logger(WalletTransactionService.name)

    constructor(
        private readonly walletRepository: WalletRepository,
    ) {}

    async processBankTransferOut(
        payload: SepayWebhookPayload,
    ): Promise<void> {
        this.logger.log(
            `[Wallet Transaction] Processing bank transfer OUT - Sepay ID: ${payload.id}, Amount: ${payload.transferAmount}`,
        )

        // 1. Check duplicate by querying sepay_metadata
        const existingTransaction =
            await this.walletRepository.findTransactionBySepayId(payload.id)

        if (existingTransaction) {
            this.logger.warn(
                `[Wallet Transaction] Duplicate Sepay transaction detected: ${payload.id}`,
            )
            throw new ConflictException(
                `Transaction with Sepay ID ${payload.id} already processed`,
            )
        }

        // 2. Get ADMIN wallet (system admin)
        const adminWallet = await this.getSystemAdminWallet()

        if (!adminWallet) {
            this.logger.error("[Wallet Transaction] Admin wallet not found")
            throw new NotFoundException("Admin wallet not found")
        }

        // 3. Validate admin balance >= withdrawal amount
        const withdrawalAmount = BigInt(payload.transferAmount)
        const balanceBefore = BigInt(adminWallet.balance) // Convert string to BigInt

        if (balanceBefore < withdrawalAmount) {
            this.logger.error(
                `[Wallet Transaction] Insufficient balance. Required: ${withdrawalAmount}, Available: ${balanceBefore}`,
            )
            throw new BadRequestException(
                `Insufficient admin wallet balance. Available: ${balanceBefore}, Required: ${withdrawalAmount}`,
            )
        }

        // 4. Calculate new balance
        const balanceAfter = balanceBefore - withdrawalAmount

        // 5. Database transaction: Update wallet + Create transaction record
        try {
            await this.walletRepository.atomicWithdrawal({
                walletId: adminWallet.id,
                amount: withdrawalAmount,
                balanceBefore,
                balanceAfter,
                transactionType: Transaction_Type.WITHDRAWAL,
                gateway: payload.gateway,
                description: `Bank transfer OUT - ${payload.description || payload.content}`,
                sepayMetadata: payload,
            })

            this.logger.log(
                `[Wallet Transaction] Successfully processed withdrawal. Sepay ID: ${payload.id}, Amount: ${withdrawalAmount}, Balance: ${balanceBefore} → ${balanceAfter}`,
            )
        } catch (error) {
            this.logger.error(
                `[Wallet Transaction] Failed to process withdrawal: ${error.message}`,
                error.stack,
            )

            throw error
        }
    }

    /**
     * Get system admin wallet
     */
    private async getSystemAdminWallet() {
        const adminWallets = await this.walletRepository.findAllByType(
            Wallet_Type.ADMIN,
            0,
            1,
        )

        if (adminWallets.wallets.length === 0) {
            return null
        }

        return adminWallets.wallets[0]
    }
}
