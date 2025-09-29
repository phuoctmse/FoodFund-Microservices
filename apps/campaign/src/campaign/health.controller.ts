import { Controller, Get, HttpStatus, Res } from "@nestjs/common"
import { CampaignService } from "./campaign.service"
import { Response } from "express"

@Controller("health")
export class HealthController {
    constructor(private readonly campaignService: CampaignService) {}

    @Get()
    async getHealth(@Res() res: Response) {
        try {
            const health = this.campaignService.getHealth()
            const dbHealth = await this.campaignService.checkDatabaseHealth()

            const healthStatus = {
                status: "healthy",
                service: "campaign-service",
                timestamp: new Date().toISOString(),
                details: {
                    ...health,
                    database: dbHealth,
                },
                environment: {
                    nodeEnv: process.env.NODE_ENV,
                    port: process.env.PORT || 8004,
                    hasDatabase: !!process.env.CAMPAIGN_DATABASE_URL,
                    hasSpaces: !!process.env.SPACES_CDN_ENDPOINT,
                },
                checks: {
                    service: "ok",
                    database: "ok",
                    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
                    uptime: `${Math.round(process.uptime())}s`,
                },
            }

            res.status(HttpStatus.OK).json(healthStatus)
        } catch (error) {
            const errorStatus = {
                status: "unhealthy",
                service: "campaign-service",
                timestamp: new Date().toISOString(),
                error: error.message || "Service health check failed",
                environment: {
                    nodeEnv: process.env.NODE_ENV,
                    port: process.env.PORT || 8004,
                    hasDatabase: !!process.env.CAMPAIGN_DATABASE_URL,
                    hasSpaces: !!process.env.SPACES_CDN_ENDPOINT,
                },
                checks: {
                    service: "error",
                    database: "unknown",
                    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
                    uptime: `${Math.round(process.uptime())}s`,
                },
            }

            res.status(HttpStatus.SERVICE_UNAVAILABLE).json(errorStatus)
        }
    }

    @Get("db")
    async getDatabaseHealth(@Res() res: Response) {
        try {
            const dbHealth = await this.campaignService.checkDatabaseHealth()
            res.status(HttpStatus.OK).json({
                status: "healthy",
                database: "connected",
                details: dbHealth,
                timestamp: new Date().toISOString(),
            })
        } catch (error) {
            res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
                status: "unhealthy",
                database: "disconnected",
                error: error.message || "Database connection failed",
                timestamp: new Date().toISOString(),
            })
        }
    }

    @Get("ready")
    async getReadiness(@Res() res: Response) {
        try {
            const [serviceHealth, dbHealth] = await Promise.allSettled([
                Promise.resolve(this.campaignService.getHealth()),
                this.campaignService.checkDatabaseHealth(),
            ])

            const isServiceReady = serviceHealth.status === "fulfilled"
            const isDbReady = dbHealth.status === "fulfilled"
            const isReady = isServiceReady && isDbReady

            const readinessStatus = {
                status: isReady ? "ready" : "not-ready",
                service: isServiceReady ? "healthy" : "unhealthy",
                database: isDbReady ? "connected" : "disconnected",
                timestamp: new Date().toISOString(),
                details: {
                    service:
                        serviceHealth.status === "fulfilled"
                            ? serviceHealth.value
                            : { error: serviceHealth.reason },
                    database:
                        dbHealth.status === "fulfilled"
                            ? dbHealth.value
                            : { error: dbHealth.reason },
                },
            }

            const statusCode = isReady
                ? HttpStatus.OK
                : HttpStatus.SERVICE_UNAVAILABLE
            res.status(statusCode).json(readinessStatus)
        } catch (error) {
            res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
                status: "not-ready",
                error: error.message,
                timestamp: new Date().toISOString(),
            })
        }
    }
}
