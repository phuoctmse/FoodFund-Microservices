import { Injectable, Logger } from "@nestjs/common"
import { BrevoEmailService } from "@libs/email"
import { UserClientService } from "@app/campaign/src/shared"

@Injectable()
export class DonationEmailService {
    private readonly logger = new Logger(DonationEmailService.name)

    constructor(
        private readonly emailService: BrevoEmailService,
        private readonly userClientService: UserClientService,
    ) {}

    async sendDonationConfirmation(
        donation: any,
        amount: bigint,
        campaign: any,
        source: "PayOS" | "Sepay" = "PayOS",
    ): Promise<void> {
        try {
            // Skip if anonymous donation or no donor_id
            if (donation.is_anonymous || !donation.donor_id) {
                this.logger.log(
                    `[${source}] Skipping email - Anonymous donation or no donor_id`,
                )
                return
            }

            // Fetch donor user information
            const donor = await this.userClientService.getUserByCognitoId(
                donation.donor_id,
            )
            if (!donor || !donor.email) {
                this.logger.warn(
                    `[${source}] Cannot send email - Donor ${donation.donor_id} not found or no email`,
                )
                return
            }

            // Fetch fundraiser name from created_by UUID
            let fundraiserName = "FoodFund Team"
            if (campaign.created_by) {
                const fundraiser = await this.userClientService.getUserByCognitoId(
                    campaign.created_by,
                )
                if (fundraiser) {
                    fundraiserName =
                        fundraiser.fullName ||
                        fundraiser.username ||
                        "FoodFund Team"
                }
            }

            // Format amount in Vietnamese locale
            const formattedAmount = new Intl.NumberFormat("vi-VN").format(
                Number(amount),
            )

            // Send email via Brevo
            await this.emailService.sendDonationConfirmation(
                donor.email,
                donor.fullName || donor.username || "Donor",
                formattedAmount,
                campaign.title || "Campaign",
                fundraiserName,
            )

            this.logger.log(
                `[${source}] ✅ Donation confirmation email sent to ${donor.email}`,
            )
        } catch (error) {
            this.logger.error(
                `[${source}] Failed to send donation confirmation email:`,
                error.stack,
            )
        }
    }
}
