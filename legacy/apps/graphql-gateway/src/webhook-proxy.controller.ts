import { All, Controller, Req, Res } from "@nestjs/common"
import { Request, Response } from "express"
import axios from "axios"
import { envConfig } from "@libs/env"

@Controller("webhooks")
export class WebhookProxyController {
    private readonly campaignServiceHost =
        envConfig().containers["campaigns-subgraph"]?.host || "localhost"
    private readonly campaignServicePort =
        envConfig().containers["campaigns-subgraph"]?.port || "8004"

    @All("*path")
    async proxyWebhook(@Req() req: Request, @Res() res: Response) {
        // req.url includes /webhooks prefix, so we need to keep it
        const targetUrl = `http://${this.campaignServiceHost}:${this.campaignServicePort}${req.url}`

        console.log(`[Webhook Proxy] ${req.method} ${req.url} -> ${targetUrl}`)
        console.log("[Webhook Proxy] Body:", JSON.stringify(req.body))

        try {
            console.log("[Webhook Proxy] Forwarding to campaign service...")

            const response = await axios({
                method: req.method,
                url: targetUrl,
                data: req.body,
                headers: {
                    "content-type": "application/json",
                },
                validateStatus: () => true, // Accept any status code
                timeout: 10000, // 10 second timeout
            })

            console.log(`[Webhook Proxy] Response status: ${response.status}`)
            console.log("[Webhook Proxy] Response data:", response.data)

            // Forward response
            res.status(response.status)
            Object.keys(response.headers).forEach((key) => {
                res.setHeader(key, response.headers[key])
            })
            res.send(response.data)
        } catch (error) {
            console.error("[Webhook Proxy Error]", {
                message: error.message,
                code: error.code,
                response: error.response?.data,
                stack: error.stack,
            })
            res.status(500).json({
                error: "Proxy error",
                message: error.message,
                details: error.code || "Unknown error",
            })
        }
    }
}
