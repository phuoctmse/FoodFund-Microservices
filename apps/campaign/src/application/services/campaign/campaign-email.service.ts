import { Injectable, Logger } from "@nestjs/common"
import { BrevoEmailService } from "@libs/email"
import { envConfig } from "@libs/env"

interface CampaignApprovedEmailData {
    fundraiserEmail: string
    fundraiserName: string
    campaignTitle: string
    campaignId: string
    transferredAmount: string
    walletBalance: string
}

interface SurplusTransferEmailData {
    donorEmail: string
    donorName: string
    oldCampaignTitle: string
    newCampaignTitle: string
    newCampaignId: string
    fundraiserName: string
}

interface CampaignStatusChangeEmailData {
    email: string
    name: string
    campaignTitle: string
    campaignId: string
    oldStatus: string
    newStatus: string
    isForFundraiser: boolean
}

@Injectable()
export class CampaignEmailService {
    private readonly logger = new Logger(CampaignEmailService.name)
    env = envConfig()

    constructor(private readonly brevoEmailService: BrevoEmailService) {}

    /**
     * Send email to fundraiser when campaign is approved with auto-transfer
     */
    async sendCampaignApprovedWithTransfer(
        data: CampaignApprovedEmailData,
    ): Promise<void> {
        try {
            this.logger.log(
                `Sending campaign approved email to ${data.fundraiserEmail}`,
            )

            await this.brevoEmailService.sendEmail({
                to: data.fundraiserEmail,
                subject: `🎉 Chiến dịch "${data.campaignTitle}" đã được phê duyệt!`,
                html: this.buildApprovedEmailHtml(data),
                tags: ["campaign-approved", "auto-transfer"],
            })

            this.logger.log(
                `✅ Campaign approved email sent to ${data.fundraiserEmail}`,
            )
        } catch (error) {
            this.logger.error(
                "Failed to send campaign approved email:",
                error.message,
            )
        }
    }

    /**
     * Send email to donors about surplus being used for new campaign
     */
    async sendSurplusTransferNotification(
        data: SurplusTransferEmailData,
    ): Promise<void> {
        try {
            this.logger.log(
                `Sending surplus transfer email to ${data.donorEmail}`,
            )

            await this.brevoEmailService.sendEmail({
                to: data.donorEmail,
                subject: "💝 Số tiền dư thừa của bạn đã được chuyển sang chiến dịch mới",
                html: this.buildSurplusTransferEmailHtml(data),
                tags: ["surplus-transfer", "donor-notification"],
            })

            this.logger.log(
                `✅ Surplus transfer email sent to ${data.donorEmail}`,
            )
        } catch (error) {
            this.logger.error(
                "Failed to send surplus transfer email:",
                error.message,
            )
        }
    }

    /**
     * Send email about campaign status change
     */
    async sendCampaignStatusChange(
        data: CampaignStatusChangeEmailData,
    ): Promise<void> {
        try {
            this.logger.log(
                `Sending status change email to ${data.email} (${data.isForFundraiser ? "fundraiser" : "donor"})`,
            )

            await this.brevoEmailService.sendEmail({
                to: data.email,
                subject: `📢 Cập nhật chiến dịch "${data.campaignTitle}"`,
                html: this.buildStatusChangeEmailHtml(data),
                tags: ["campaign-status-change", data.newStatus.toLowerCase()],
            })

            this.logger.log(`✅ Status change email sent to ${data.email}`)
        } catch (error) {
            this.logger.error(
                "Failed to send status change email:",
                error.message,
            )
        }
    }

    /**
     * Send batch emails to donors about surplus transfer
     * Rate limited: 10 emails per batch with 1 second delay
     */
    async sendBatchSurplusEmails(
        donors: Array<{
            email: string
            name: string
            oldCampaignTitle: string
            newCampaignTitle: string
            newCampaignId: string
            fundraiserName: string
        }>,
    ): Promise<void> {
        const BATCH_SIZE = 10
        const DELAY_MS = 1000

        this.logger.log(
            `Starting batch email send to ${donors.length} donors (${Math.ceil(donors.length / BATCH_SIZE)} batches)`,
        )

        for (let i = 0; i < donors.length; i += BATCH_SIZE) {
            const batch = donors.slice(i, i + BATCH_SIZE)
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1

            this.logger.log(
                `Processing batch ${batchNumber}: ${batch.length} emails`,
            )

            // Send emails in parallel within batch
            const emailPromises = batch.map((donor) =>
                this.sendSurplusTransferNotification({
                    donorEmail: donor.email,
                    donorName: donor.name,
                    oldCampaignTitle: donor.oldCampaignTitle,
                    newCampaignTitle: donor.newCampaignTitle,
                    newCampaignId: donor.newCampaignId,
                    fundraiserName: donor.fundraiserName,
                }).catch((error) => {
                    this.logger.error(
                        `Failed to send email to ${donor.email}:`,
                        error.message,
                    )
                }),
            )

            await Promise.all(emailPromises)

            // Delay between batches (except for last batch)
            if (i + BATCH_SIZE < donors.length) {
                this.logger.log(`Waiting ${DELAY_MS}ms before next batch...`)
                await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
            }
        }

        this.logger.log("✅ Batch email send completed")
    }

    private buildApprovedEmailHtml(data: CampaignApprovedEmailData): string {
        return `
        <div style="background-color: #f7fafc; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">
                        🎉 Chiến Dịch Đã Được Phê Duyệt!
                    </h1>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; opacity: 0.9;">
                        Chiến dịch của bạn đã sẵn sàng để nhận quyên góp
                    </p>
                </div>

                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Xin chào <strong>${data.fundraiserName}</strong>,
                    </p>
                    
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Chúc mừng! Chiến dịch <strong>"${data.campaignTitle}"</strong> của bạn đã được phê duyệt và đang hoạt động trên nền tảng FoodFund.
                    </p>

                    ${data.transferredAmount !== "0" ? `
                    <!-- Auto-transfer Info -->
                    <div style="background: linear-gradient(135deg, #ebf8ff 0%, #e6fffa 100%); border-left: 4px solid #4299e1; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <p style="color: #2c5282; font-size: 14px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">
                            💰 Chuyển Tiền Tự Động
                        </p>
                        <p style="color: #2d3748; font-size: 16px; margin: 0 0 10px 0;">
                            Hệ thống đã tự động chuyển <strong style="color: #2c5282;">${data.transferredAmount} VNĐ</strong> từ ví của bạn vào chiến dịch này.
                        </p>
                        <p style="color: #4a5568; font-size: 14px; margin: 0;">
                            Số dư ví còn lại: <strong>${data.walletBalance} VNĐ</strong>
                        </p>
                    </div>
                    ` : ""}

                    <!-- Next Steps -->
                    <div style="background-color: #f7fafc; border-radius: 8px; padding: 25px; margin: 25px 0;">
                        <p style="color: #2d3748; font-size: 16px; font-weight: 600; margin: 0 0 15px 0;">
                            📋 Bước tiếp theo:
                        </p>
                        <ul style="color: #4a5568; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                            <li>Chia sẻ chiến dịch với cộng đồng của bạn</li>
                            <li>Theo dõi tiến độ quyên góp trên dashboard</li>
                            <li>Cập nhật thông tin và hình ảnh định kỳ</li>
                            <li>Chuẩn bị cho các giai đoạn thực hiện</li>
                        </ul>
                    </div>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${this.env.frontEndUrl}/campaign/${data.campaignId}" 
                           style="display: inline-block; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(72, 187, 120, 0.3);">
                            Xem Chiến Dịch
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #edf2f7; padding: 25px; text-align: center;">
                    <p style="color: #718096; font-size: 14px; margin: 0;">
                        Chúc bạn thành công với chiến dịch!<br>
                        <strong>Đội ngũ FoodFund</strong>
                    </p>
                </div>
            </div>
        </div>
        `
    }

    private buildSurplusTransferEmailHtml(
        data: SurplusTransferEmailData,
    ): string {
        return `
        <div style="background-color: #f7fafc; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">
                        💝 Sự Đóng Góp Của Bạn Tiếp Tục Lan Tỏa
                    </h1>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; opacity: 0.9;">
                        Số tiền dư thừa đã được chuyển sang chiến dịch mới
                    </p>
                </div>

                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Thân gửi <strong>${data.donorName}</strong>,
                    </p>
                    
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Cảm ơn bạn đã ủng hộ chiến dịch <strong>"${data.oldCampaignTitle}"</strong>. 
                        Chiến dịch đã hoàn thành thành công với số tiền vượt mục tiêu!
                    </p>

                    <!-- Transfer Info -->
                    <div style="background: linear-gradient(135deg, #fef5e7 0%, #fdebd0 100%); border-left: 4px solid #f39c12; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <p style="color: #7d6608; font-size: 14px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">
                            🔄 Chuyển Tiếp Yêu Thương
                        </p>
                        <p style="color: #2d3748; font-size: 16px; margin: 0 0 10px 0;">
                            Số tiền dư thừa từ chiến dịch trước đã được <strong>${data.fundraiserName}</strong> 
                            chuyển sang chiến dịch mới: <strong>"${data.newCampaignTitle}"</strong>
                        </p>
                        <p style="color: #4a5568; font-size: 14px; margin: 0;">
                            Sự đóng góp của bạn tiếp tục mang lại giá trị và giúp đỡ thêm nhiều người cần hỗ trợ.
                        </p>
                    </div>

                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                        Bạn có thể theo dõi tiến độ của chiến dịch mới và tiếp tục ủng hộ nếu muốn.
                    </p>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${this.env.frontEndUrl}/campaign/${data.newCampaignId}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                            Xem Chiến Dịch Mới
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #edf2f7; padding: 25px; text-align: center;">
                    <p style="color: #718096; font-size: 14px; margin: 0;">
                        Cảm ơn bạn đã đồng hành cùng FoodFund!<br>
                        <strong>Đội ngũ FoodFund</strong>
                    </p>
                </div>
            </div>
        </div>
        `
    }

    private buildStatusChangeEmailHtml(
        data: CampaignStatusChangeEmailData,
    ): string {
        const statusInfo = this.getStatusInfo(data.newStatus)

        return `
        <div style="background-color: #f7fafc; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                
                <!-- Header -->
                <div style="background: ${statusInfo.gradient}; padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">
                        ${statusInfo.icon} ${statusInfo.title}
                    </h1>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; opacity: 0.9;">
                        Cập nhật về chiến dịch "${data.campaignTitle}"
                    </p>
                </div>

                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Xin chào <strong>${data.name}</strong>,
                    </p>
                    
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        ${statusInfo.message}
                    </p>

                    <!-- Status Change Info -->
                    <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="text-align: center; flex: 1;">
                                <p style="color: #718096; font-size: 12px; margin: 0 0 5px 0;">Trạng thái cũ</p>
                                <p style="color: #2d3748; font-size: 16px; font-weight: 600; margin: 0;">${data.oldStatus}</p>
                            </div>
                            <div style="color: #cbd5e0; font-size: 24px; padding: 0 20px;">→</div>
                            <div style="text-align: center; flex: 1;">
                                <p style="color: #718096; font-size: 12px; margin: 0 0 5px 0;">Trạng thái mới</p>
                                <p style="color: ${statusInfo.color}; font-size: 16px; font-weight: 600; margin: 0;">${data.newStatus}</p>
                            </div>
                        </div>
                    </div>

                    ${statusInfo.additionalInfo}

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${this.env.frontEndUrl}/campaign/${data.campaignId}" 
                           style="display: inline-block; background: ${statusInfo.gradient}; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                            Xem Chi Tiết
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #edf2f7; padding: 25px; text-align: center;">
                    <p style="color: #718096; font-size: 14px; margin: 0;">
                        Cảm ơn bạn đã đồng hành cùng FoodFund!<br>
                        <strong>Đội ngũ FoodFund</strong>
                    </p>
                </div>
            </div>
        </div>
        `
    }

    private getStatusInfo(status: string): {
        icon: string
        title: string
        message: string
        color: string
        gradient: string
        additionalInfo: string
    } {
        const statusMap: Record<string, any> = {
            PROCESSING: {
                icon: "⚙️",
                title: "Chiến Dịch Đang Xử Lý",
                message:
                    "Chiến dịch đang trong quá trình xử lý và phân phối nguồn lực.",
                color: "#3182ce",
                gradient: "linear-gradient(135deg, #4299e1 0%, #3182ce 100%)",
                additionalInfo: `
                    <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
                        Đội ngũ đang làm việc để đảm bảo nguồn lực được sử dụng hiệu quả nhất.
                    </p>
                `,
            },
            COMPLETED: {
                icon: "✅",
                title: "Chiến Dịch Hoàn Thành",
                message:
                    "Chiến dịch đã hoàn thành thành công! Cảm ơn sự đóng góp của bạn.",
                color: "#38a169",
                gradient: "linear-gradient(135deg, #48bb78 0%, #38a169 100%)",
                additionalInfo: `
                    <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
                        Tất cả các mục tiêu đã được đạt được và nguồn lực đã được phân phối đến người cần.
                    </p>
                `,
            },
            ENDED: {
                icon: "🏁",
                title: "Chiến Dịch Đã Kết Thúc",
                message: "Chiến dịch đã kết thúc thời gian quyên góp.",
                color: "#718096",
                gradient: "linear-gradient(135deg, #a0aec0 0%, #718096 100%)",
                additionalInfo: `
                    <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
                        Cảm ơn tất cả những ai đã đóng góp cho chiến dịch này.
                    </p>
                `,
            },
            CANCELLED: {
                icon: "❌",
                title: "Chiến Dịch Đã Bị Hủy",
                message: "Chiến dịch đã bị hủy bỏ.",
                color: "#e53e3e",
                gradient: "linear-gradient(135deg, #fc8181 0%, #e53e3e 100%)",
                additionalInfo: `
                    <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
                        Nếu bạn đã quyên góp, số tiền sẽ được hoàn trả hoặc chuyển sang chiến dịch khác theo chính sách.
                    </p>
                `,
            },
        }

        return (
            statusMap[status] || {
                icon: "📢",
                title: "Cập Nhật Chiến Dịch",
                message: "Chiến dịch có cập nhật mới.",
                color: "#4a5568",
                gradient: "linear-gradient(135deg, #718096 0%, #4a5568 100%)",
                additionalInfo: "",
            }
        )
    }
}
