import { Injectable, Logger } from "@nestjs/common"
import * as Brevo from "@getbrevo/brevo"
import { envConfig } from "@libs/env"

export interface EmailRecipient {
    email: string
    name?: string
}

export interface EmailAttachment {
    content: string // Base64 encoded content
    name: string
}

export interface EmailOptions {
    to: string | string[] | EmailRecipient | EmailRecipient[]
    subject: string
    html?: string
    text?: string
    templateId?: number
    params?: Record<string, any>
    cc?: string | string[] | EmailRecipient | EmailRecipient[]
    bcc?: string | string[] | EmailRecipient | EmailRecipient[]
    replyTo?: EmailRecipient
    attachments?: EmailAttachment[]
    tags?: string[]
}

export interface SendEmailResponse {
    messageId: string
}

@Injectable()
export class BrevoEmailService {
    private readonly logger = new Logger(BrevoEmailService.name)
    private readonly apiInstance: Brevo.TransactionalEmailsApi
    private readonly isEnabled: boolean
    env = envConfig()

    constructor() {
        const apiKey = this.env.brevo.apiKey

        if (!apiKey) {
            this.logger.warn(
                "BREVO_API_KEY not found, email service will be disabled",
            )
            this.isEnabled = false
            return
        }

        try {
            // Initialize API instance with API key
            this.apiInstance = new Brevo.TransactionalEmailsApi()
            this.apiInstance.setApiKey(
                Brevo.TransactionalEmailsApiApiKeys.apiKey,
                apiKey,
            )

            this.isEnabled = true
            this.logger.log("Brevo email service initialized successfully")
        } catch (err) {
            this.logger.error("Failed to initialize Brevo SDK", err)
            this.isEnabled = false
        }
    }

    /**
     * Normalize email recipients to Brevo format
     */
    private normalizeRecipients(
        recipients: string | string[] | EmailRecipient | EmailRecipient[],
    ): Array<Brevo.SendSmtpEmailToInner> {
        const recipientArray = Array.isArray(recipients)
            ? recipients
            : [recipients]

        return recipientArray.map((recipient) => {
            if (typeof recipient === "string") {
                return { email: recipient }
            }
            return {
                email: recipient.email,
                name: recipient.name,
            }
        })
    }

    /**
     * Send transactional email
     */
    async sendEmail(options: EmailOptions): Promise<SendEmailResponse | null> {
        try {
            if (!this.isEnabled || !this.apiInstance) {
                this.logger.warn(
                    "Email service not initialized - missing API key or SDK",
                )
                return null
            }

            // Build email payload
            const sendSmtpEmail = new Brevo.SendSmtpEmail()

            // Sender
            sendSmtpEmail.sender = {
                email: this.env.brevo.senderEmail,
                name: this.env.brevo.senderName,
            }

            // Recipients
            sendSmtpEmail.to = this.normalizeRecipients(options.to)

            // Optional CC and BCC
            if (options.cc) {
                sendSmtpEmail.cc = this.normalizeRecipients(options.cc)
            }
            if (options.bcc) {
                sendSmtpEmail.bcc = this.normalizeRecipients(options.bcc)
            }

            // Reply-To
            if (options.replyTo) {
                sendSmtpEmail.replyTo = {
                    email: options.replyTo.email,
                    name: options.replyTo.name,
                }
            }

            // Subject
            sendSmtpEmail.subject = options.subject

            // Content - either template or custom HTML/text
            if (options.templateId) {
                sendSmtpEmail.templateId = options.templateId
                if (options.params) {
                    sendSmtpEmail.params = options.params
                }
            } else {
                if (options.html) {
                    sendSmtpEmail.htmlContent = options.html
                }
                if (options.text) {
                    sendSmtpEmail.textContent = options.text
                }
            }

            // Attachments
            if (options.attachments && options.attachments.length > 0) {
                sendSmtpEmail.attachment = options.attachments.map((att) => ({
                    content: att.content,
                    name: att.name,
                }))
            }

            // Tags for tracking
            if (options.tags && options.tags.length > 0) {
                sendSmtpEmail.tags = options.tags
            }

            // Send email
            const result =
                await this.apiInstance.sendTransacEmail(sendSmtpEmail)

            // Extract messageId from response
            const messageId =
                (result as any).body?.messageId ||
                (result as any).response?.body?.messageId ||
                (result as Brevo.CreateSmtpEmail).messageId ||
                "unknown"

            this.logger.log(`Email sent successfully. MessageId: ${messageId}`)

            return { messageId }
        } catch (error) {
            this.logger.error("Failed to send email:", error)
            if ((error as any).response) {
                this.logger.error(
                    `Brevo API error: ${JSON.stringify((error as any).response.body)}`,
                )
            }
            return null
        }
    }
    /**
     * Send welcome email to new fundraiser
     */
    async sendWelcomeEmail(
        email: string,
        fundraiserName: string,
    ): Promise<SendEmailResponse | null> {
        return this.sendEmail({
            to: email,
            subject: "Welcome to FoodFund - Start Your Fundraising Journey!",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #2d3748;">Welcome to FoodFund, ${fundraiserName}!</h1>
                    <p style="color: #4a5568; line-height: 1.6;">
                        Congratulations on joining FoodFund! You're now part of a community dedicated to
                        combating food insecurity through transparent and efficient food distribution.
                    </p>
                    <p style="color: #4a5568; line-height: 1.6;">
                        Here's what you can do next:
                    </p>
                    <ul style="color: #4a5568; line-height: 1.6;">
                        <li>Create your first campaign</li>
                        <li>Set up your fundraiser profile</li>
                        <li>Learn about our disbursement process</li>
                    </ul>
                    <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; color: #2d3748; font-weight: bold;">
                            Need help getting started?
                        </p>
                        <p style="margin: 10px 0 0 0; color: #4a5568;">
                            Visit our documentation or contact support.
                        </p>
                    </div>
                    <p style="color: #4a5568;">
                        Best regards,<br>
                        The FoodFund Team
                    </p>
                </div>
            `,
        })
    }

    /**
     * Send campaign approval notification
     */
    async sendCampaignApproved(
        email: string,
        campaignTitle: string,
        fundraiserName: string,
    ): Promise<SendEmailResponse | null> {
        return this.sendEmail({
            to: email,
            subject: `🎉 Your campaign "${campaignTitle}" has been approved!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #38a169;">Campaign Approved! 🎉</h1>
                    <p style="color: #4a5568; line-height: 1.6;">
                        Hi ${fundraiserName},
                    </p>
                    <p style="color: #4a5568; line-height: 1.6;">
                        Great news! Your campaign <strong>"${campaignTitle}"</strong> has been approved
                        and is now live on FoodFund.
                    </p>
                    <p style="color: #4a5568; line-height: 1.6;">
                        Donors can now contribute to your campaign, and you'll receive notifications
                        as donations come in.
                    </p>
                    <div style="background: #f0fff4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #38a169;">
                        <p style="margin: 0; color: #2d3748; font-weight: bold;">
                            What's next?
                        </p>
                        <ul style="margin: 10px 0 0 0; color: #4a5568; padding-left: 20px;">
                            <li>Share your campaign with your network</li>
                            <li>Monitor donation progress</li>
                            <li>Prepare for disbursement requests</li>
                        </ul>
                    </div>
                    <p style="color: #4a5568;">
                        Keep up the great work!<br>
                        The FoodFund Team
                    </p>
                </div>
            `,
        })
    }

    /**
     * Send disbursement confirmation to fundraiser
     */
    async sendDisbursementConfirmation(
        email: string,
        fundraiserName: string,
        amount: string,
        campaignTitle: string,
    ): Promise<SendEmailResponse | null> {
        return this.sendEmail({
            to: email,
            subject: `💰 Disbursement Confirmed - ${amount} VND`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #3182ce;">Disbursement Confirmed 💰</h1>
                    <p style="color: #4a5568; line-height: 1.6;">
                        Hi ${fundraiserName},
                    </p>
                    <p style="color: #4a5568; line-height: 1.6;">
                        Your disbursement request for <strong>${amount} VND</strong> from campaign
                        <strong>"${campaignTitle}"</strong> has been processed.
                    </p>
                    <div style="background: #ebf8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3182ce;">
                        <p style="margin: 0; color: #2d3748; font-weight: bold;">
                            Important Information:
                        </p>
                        <ul style="margin: 10px 0 0 0; color: #4a5568; padding-left: 20px;">
                            <li>Please check your bank account within 1-2 business days</li>
                            <li>If you don't receive the funds, please contact support</li>
                            <li>This transaction is tracked for transparency</li>
                        </ul>
                    </div>
                    <p style="color: #4a5568;">
                        Thank you for your work in the community!<br>
                        The FoodFund Team
                    </p>
                </div>
            `,
        })
    }

    /**
     * Send donation confirmation to donor
     */
    async sendDonationConfirmation(
        email: string,
        donorName: string,
        amount: string,
        campaignTitle: string,
        fundraiserName: string,
    ): Promise<SendEmailResponse | null> {
        return this.sendEmail({
            to: email,
            subject: `❤️ Cảm ơn bạn đã ủng hộ chiến dịch "${campaignTitle}"`,
            html: `
        <div style="background-color: #f7fafc; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                
                <div style="background-color: #e53e3e; padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Cảm Ơn Tấm Lòng Vàng! ❤️</h1>
                </div>

                <div style="padding: 30px;">
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Thân gửi <strong>${donorName}</strong>,
                    </p>
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Thay mặt đội ngũ FoodFund và cộng đồng, chúng tôi xin gửi lời cảm ơn chân thành nhất vì sự đóng góp của bạn cho chiến dịch <strong>"${campaignTitle}"</strong> do <strong>${fundraiserName}</strong> tổ chức.
                    </p>
                    
                    <div style="background-color: #fff5f5; border: 1px solid #feb2b2; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
                        <span style="display: block; color: #718096; font-size: 14px; margin-bottom: 5px;">Số tiền bạn đã quyên góp</span>
                        <span style="display: block; color: #c53030; font-size: 28px; font-weight: bold;">${amount} VNĐ</span>
                    </div>

                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                        Sự chia sẻ của bạn không chỉ là vật chất mà còn là nguồn động viên tinh thần to lớn, giúp mang lại những bữa ăn ấm áp và hỗ trợ thiết thực cho những hoàn cảnh khó khăn.
                    </p>

                    <div style="margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 20px;">
                        <p style="margin: 0 0 15px 0; color: #2d3748; font-weight: bold;">Cam kết của chúng tôi:</p>
                        <ul style="margin: 0; color: #4a5568; padding-left: 20px; list-style-type: circle;">
                            <li style="margin-bottom: 8px;">100% số tiền ủng hộ được chuyển trực tiếp đến chiến dịch.</li>
                            <li style="margin-bottom: 8px;">Minh bạch hoá sao kê và quá trình sử dụng quỹ.</li>
                            <li style="margin-bottom: 8px;">Lan toả yêu thương và đẩy lùi nạn đói.</li>
                        </ul>
                    </div>
                </div>

                <div style="background-color: #edf2f7; padding: 20px; text-align: center; font-size: 14px; color: #718096;">
                    <p style="margin: 0;">Trân trọng,<br><strong>Đội ngũ FoodFund</strong></p>
                </div>
            </div>
        </div>
    `,
        })
    }
}
