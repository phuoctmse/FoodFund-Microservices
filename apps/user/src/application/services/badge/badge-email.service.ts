import { Injectable, Logger } from "@nestjs/common"
import { BrevoEmailService } from "@libs/email"

interface BadgeEmailData {
    userEmail: string
    userName: string
    badgeName: string
    badgeDescription: string
    badgeIconUrl: string
    totalDonated: string
    donationCount: number
}

@Injectable()
export class BadgeEmailService {
    private readonly logger = new Logger(BadgeEmailService.name)

    constructor(private readonly brevoEmailService: BrevoEmailService) {}

    /**
     * Send badge award notification email to user
     */
    async sendBadgeAwardEmail(data: BadgeEmailData): Promise<void> {
        try {
            const {
                userEmail,
                badgeName
            } = data

            this.logger.log(
                `Sending badge award email to ${userEmail} for badge: ${badgeName}`,
            )

            await this.brevoEmailService.sendEmail({
                to: userEmail,
                subject: `🎖️ Chúc mừng! Bạn đã nhận được huy hiệu "${badgeName}"`,
                html: this.buildBadgeEmailHtml(data),
                tags: ["badge-award", badgeName.toLowerCase().replace(/\s+/g, "-")],
            })

            this.logger.log(
                `✅ Badge award email sent successfully to ${userEmail}`,
            )
        } catch (error) {
            this.logger.error(
                `Failed to send badge award email to ${data.userEmail}:`,
                error.message,
            )
        }
    }

    /**
     * Build HTML email template for badge award
     */
    private buildBadgeEmailHtml(data: BadgeEmailData): string {
        const {
            userName,
            badgeName,
            badgeDescription,
            badgeIconUrl,
            totalDonated,
            donationCount,
        } = data

        return `
        <div style="background-color: #f7fafc; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">
                        🎖️ Chúc Mừng!
                    </h1>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; opacity: 0.9;">
                        Bạn đã nhận được huy hiệu mới
                    </p>
                </div>

                <!-- Badge Display -->
                <div style="padding: 40px 30px; text-align: center;">
                    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); width: 120px; height: 120px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                        <img src="${badgeIconUrl}" alt="${badgeName}" style="width: 80px; height: 80px; object-fit: contain;" />
                    </div>
                    
                    <h2 style="color: #2d3748; margin: 0 0 10px 0; font-size: 24px; font-weight: 700;">
                        ${badgeName}
                    </h2>
                    
                    <p style="color: #718096; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        ${badgeDescription}
                    </p>

                    <!-- Stats -->
                    <div style="background-color: #f7fafc; border-radius: 8px; padding: 25px; margin: 30px 0;">
                        <p style="color: #4a5568; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                            Thành Tích Của Bạn
                        </p>
                        
                        <div style="display: flex; justify-content: space-around; flex-wrap: wrap;">
                            <div style="text-align: center; min-width: 120px; margin: 10px;">
                                <div style="color: #667eea; font-size: 32px; font-weight: 700; margin-bottom: 5px;">
                                    ${totalDonated}
                                </div>
                                <div style="color: #718096; font-size: 14px;">
                                    Tổng quyên góp
                                </div>
                            </div>
                            
                            <div style="text-align: center; min-width: 120px; margin: 10px;">
                                <div style="color: #f5576c; font-size: 32px; font-weight: 700; margin-bottom: 5px;">
                                    ${donationCount}
                                </div>
                                <div style="color: #718096; font-size: 14px;">
                                    Lần ủng hộ
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Message -->
                    <div style="background-color: #fff5f5; border-left: 4px solid #f5576c; padding: 20px; border-radius: 4px; text-align: left; margin: 30px 0;">
                        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0;">
                            <strong>Thân gửi ${userName},</strong>
                        </p>
                        <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 15px 0 0 0;">
                            Cảm ơn bạn đã đồng hành cùng FoodFund trong hành trình lan tỏa yêu thương và đẩy lùi nạn đói. 
                            Mỗi đóng góp của bạn đều mang lại ý nghĩa to lớn và giúp mang đến những bữa ăn ấm áp cho những hoàn cảnh khó khăn.
                        </p>
                    </div>

                    <!-- Next Milestone (Optional) -->
                    ${this.getNextMilestoneHtml(badgeName)}
                </div>

                <!-- Footer -->
                <div style="background-color: #edf2f7; padding: 25px; text-align: center;">
                    <p style="color: #718096; font-size: 14px; margin: 0 0 10px 0;">
                        Tiếp tục hành trình của bạn và khám phá thêm nhiều huy hiệu khác!
                    </p>
                    <p style="color: #4a5568; font-size: 14px; margin: 0;">
                        Trân trọng,<br>
                        <strong>Đội ngũ FoodFund</strong>
                    </p>
                </div>
            </div>
            
            <!-- Social Proof -->
            <div style="text-align: center; margin-top: 20px; padding: 0 20px;">
                <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                    Chia sẻ thành tích của bạn với bạn bè để lan tỏa yêu thương! ❤️
                </p>
            </div>
        </div>
        `
    }

    /**
     * Get next milestone HTML based on current badge
     */
    private getNextMilestoneHtml(currentBadge: string): string {
        const milestones: Record<string, { next: string; amount: string }> = {
            "First Donation": {
                next: "Bronze Donor",
                amount: "100,000 VNĐ",
            },
            "Bronze Donor": {
                next: "Silver Donor",
                amount: "1,000,000 VNĐ",
            },
            "Silver Donor": {
                next: "Gold Donor",
                amount: "10,000,000 VNĐ",
            },
            "Gold Donor": {
                next: "Platinum Donor",
                amount: "100,000,000 VNĐ",
            },
            "Platinum Donor": {
                next: "Diamond Donor",
                amount: "500,000,000 VNĐ",
            },
        }

        const nextMilestone = milestones[currentBadge]

        if (!nextMilestone) {
            // Diamond Donor - highest badge
            return `
                <div style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #744210; font-size: 16px; font-weight: 700; margin: 0 0 5px 0;">
                        🏆 Bạn đã đạt huy hiệu cao nhất!
                    </p>
                    <p style="color: #975a16; font-size: 14px; margin: 0;">
                        Cảm ơn bạn đã là một trong những nhà hảo tâm xuất sắc nhất của FoodFund!
                    </p>
                </div>
            `
        }

        return `
            <div style="background-color: #ebf8ff; border: 1px dashed #4299e1; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #2c5282; font-size: 14px; font-weight: 600; margin: 0 0 10px 0;">
                    🎯 Huy hiệu tiếp theo
                </p>
                <p style="color: #2d3748; font-size: 16px; font-weight: 700; margin: 0 0 5px 0;">
                    ${nextMilestone.next}
                </p>
                <p style="color: #4a5568; font-size: 14px; margin: 0;">
                    Quyên góp thêm để đạt tổng <strong>${nextMilestone.amount}</strong>
                </p>
            </div>
        `
    }
}
