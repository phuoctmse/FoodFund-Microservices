import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common"
import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import { SentryService } from "libs/observability/sentry.service"
import { envConfig } from "libs/env"
import { join } from "path"

export interface GrpcServiceConfig {
    name: string
    protoPath: string
    packageName: string
    serviceName: string
    url: string
    options?: grpc.ClientOptions
}

export interface GrpcCallOptions {
    timeout?: number
    retries?: number
    metadata?: grpc.Metadata
}

@Injectable()
export class GrpcClientService implements OnModuleDestroy {
    private readonly logger = new Logger(GrpcClientService.name)
    private readonly clients = new Map<string, grpc.Client>()
    private readonly services = new Map<string, any>()

    constructor(private readonly sentryService: SentryService) {
        this.initializeServices()
    }

    private initializeServices() {
        // Register all known services using env config
        const env = envConfig()
        const services: GrpcServiceConfig[] = [
            {
                name: "user-service",
                protoPath: "user.proto",
                packageName: "foodfund.user",
                serviceName: "UserService",
                url: env.grpc.user?.url || "localhost:50002",
            },
            {
                name: "auth-service",
                protoPath: "auth.proto",
                packageName: "foodfund.auth",
                serviceName: "AuthService",
                url: env.grpc.auth?.url || "localhost:50001",
            },
            // {
            //     name: "campaign-service",
            //     protoPath: "campaign.proto",
            //     packageName: "foodfund.campaign",
            //     serviceName: "CampaignService",
            //     url: env.grpc.campaign?.url || "localhost:50003",
            // },
            // {
            //     name: "donation-service",
            //     protoPath: "donation.proto",
            //     packageName: "foodfund.donation",
            //     serviceName: "DonationService",
            //     url: env.grpc.donation?.url || "localhost:50004",
            // },
        ]

        services.forEach((config) => {
            try {
                this.registerService(config)
            } catch (error) {
                this.logger.warn(
                    `Failed to register gRPC service ${config.name}:`,
                    error.message,
                )
            }
        })
    }

    private registerService(config: GrpcServiceConfig) {
        try {
            // Load proto file
            const protoPath = join(
                process.cwd(),
                "libs",
                "grpc",
                "proto",
                config.protoPath,
            )
            const packageDefinition = protoLoader.loadSync(protoPath, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
            })

            const protoDescriptor =
                grpc.loadPackageDefinition(packageDefinition)

            // Navigate to the service
            const packageObj = this.getNestedProperty(
                protoDescriptor,
                config.packageName,
            )
            const ServiceConstructor = packageObj[config.serviceName]

            if (!ServiceConstructor) {
                throw new Error(
                    `Service ${config.serviceName} not found in package ${config.packageName}`,
                )
            }

            // Create client
            const client = new ServiceConstructor(
                config.url,
                grpc.credentials.createInsecure(),
                config.options || {},
            )

            this.clients.set(config.name, client)
            this.services.set(config.name, config)

            this.logger.log(
                `gRPC service ${config.name} registered at ${config.url}`,
            )
        } catch (error) {
            this.logger.error(
                `Failed to register gRPC service ${config.name}:`,
                error,
            )
            throw error
        }
    }

    // Generic method to call any gRPC service
    async call<TRequest = any, TResponse = any>(
        serviceName: string,
        methodName: string,
        request: TRequest,
        options?: GrpcCallOptions,
    ): Promise<TResponse> {
        const client = this.clients.get(serviceName)
        if (!client) {
            throw new Error(`gRPC service ${serviceName} not found`)
        }

        const method = client[methodName]
        if (!method || typeof method !== "function") {
            throw new Error(
                `Method ${methodName} not found in service ${serviceName}`,
            )
        }

        const timeout = options?.timeout || 5000
        const retries = options?.retries || 3
        const metadata = options?.metadata || new grpc.Metadata()

        // Add tracing metadata
        const env = envConfig()
        metadata.set("x-service-name", env.nodeEnv || "unknown")
        metadata.set("x-request-id", this.generateRequestId())

        // Add breadcrumb for tracking
        this.sentryService.addBreadcrumb(
            `gRPC call: ${serviceName}.${methodName}`,
            "grpc",
            {
                serviceName,
                methodName,
                requestId: metadata.get("x-request-id")[0],
            },
        )

        return this.executeWithRetry(
            client,
            method,
            request,
            metadata,
            timeout,
            retries,
            serviceName,
            methodName,
        )
    }

    private async executeWithRetry<TRequest, TResponse>(
        client: grpc.Client,
        method: Function,
        request: TRequest,
        metadata: grpc.Metadata,
        timeout: number,
        retries: number,
        serviceName: string,
        methodName: string,
    ): Promise<TResponse> {
        let lastError: Error | undefined

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const startTime = Date.now()

                const response = await this.promisifyGrpcCall<
                    TRequest,
                    TResponse
                >(method.bind(client), request, metadata, timeout)

                const duration = Date.now() - startTime

                // Log successful call
                this.logger.log(
                    `gRPC call successful: ${serviceName}.${methodName} (${duration}ms)`,
                )

                // Track slow calls
                if (duration > 2000) {
                    this.sentryService.captureMessage(
                        `Slow gRPC call: ${serviceName}.${methodName} took ${duration}ms`,
                        "warning",
                        { serviceName, methodName, duration, attempt },
                    )
                }

                return response
            } catch (error) {
                lastError = error as Error

                this.logger.warn(
                    `gRPC call failed (attempt ${attempt}/${retries}): ${serviceName}.${methodName}`,
                    error,
                )

                // Don't retry on certain errors
                if (this.isNonRetryableError(error)) {
                    break
                }

                // Wait before retry (exponential backoff)
                if (attempt < retries) {
                    const delay = Math.min(
                        1000 * Math.pow(2, attempt - 1),
                        5000,
                    )
                    await new Promise((resolve) => setTimeout(resolve, delay))
                }
            }
        }

        // All retries failed
        const errorToReport = lastError || new Error("Unknown gRPC error")

        this.sentryService.captureError(errorToReport, {
            grpcCall: true,
            serviceName,
            methodName,
            retries,
            finalAttempt: true,
        })

        throw new Error(
            `gRPC call failed after ${retries} attempts: ${serviceName}.${methodName} - ${errorToReport.message}`,
        )
    }

    private promisifyGrpcCall<TRequest, TResponse>(
        method: Function,
        request: TRequest,
        metadata: grpc.Metadata,
        timeout: number,
    ): Promise<TResponse> {
        return new Promise((resolve, reject) => {
            const deadline = new Date(Date.now() + timeout)

            method(
                request,
                metadata,
                { deadline },
                (error: grpc.ServiceError | null, response: TResponse) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(response)
                    }
                },
            )
        })
    }

    private isNonRetryableError(error: any): boolean {
        if (!error.code) return false

        // Don't retry on these gRPC status codes
        const nonRetryableCodes = [
            grpc.status.INVALID_ARGUMENT,
            grpc.status.NOT_FOUND,
            grpc.status.ALREADY_EXISTS,
            grpc.status.PERMISSION_DENIED,
            grpc.status.UNAUTHENTICATED,
        ]

        return nonRetryableCodes.includes(error.code)
    }

    // Convenience methods for specific services
    async callUserService<TRequest = any, TResponse = any>(
        methodName: string,
        request: TRequest,
        options?: GrpcCallOptions,
    ): Promise<TResponse> {
        return this.call<TRequest, TResponse>(
            "user-service",
            methodName,
            request,
            options,
        )
    }

    async callAuthService<TRequest = any, TResponse = any>(
        methodName: string,
        request: TRequest,
        options?: GrpcCallOptions,
    ): Promise<TResponse> {
        return this.call<TRequest, TResponse>(
            "auth-service",
            methodName,
            request,
            options,
        )
    }

    async callCampaignService<TRequest = any, TResponse = any>(
        methodName: string,
        request: TRequest,
        options?: GrpcCallOptions,
    ): Promise<TResponse> {
        return this.call<TRequest, TResponse>(
            "campaign-service",
            methodName,
            request,
            options,
        )
    }

    async callDonationService<TRequest = any, TResponse = any>(
        methodName: string,
        request: TRequest,
        options?: GrpcCallOptions,
    ): Promise<TResponse> {
        return this.call<TRequest, TResponse>(
            "donation-service",
            methodName,
            request,
            options,
        )
    }

    // Health check for all gRPC services
    async checkServicesHealth(): Promise<Record<string, any>> {
        const healthChecks = {}

        for (const [serviceName] of this.services.entries()) {
            try {
                // Most gRPC services should have a Health method
                const health = await this.call(
                    serviceName,
                    "Health",
                    {},
                    { timeout: 3000, retries: 1 },
                )
                healthChecks[serviceName] = { status: "healthy", ...health }
            } catch (error) {
                const config = this.services.get(serviceName)
                healthChecks[serviceName] = {
                    status: "unhealthy",
                    error: error.message,
                    url: config?.url,
                }
            }
        }

        return healthChecks
    }

    // Get service statistics
    getServiceStats() {
        const stats = {}
        for (const [serviceName, config] of this.services.entries()) {
            const client = this.clients.get(serviceName)
            stats[serviceName] = {
                url: config.url,
                connected: !!client,
                packageName: config.packageName,
                serviceName: config.serviceName,
            }
        }
        return stats
    }

    private getNestedProperty(obj: any, path: string): any {
        return path
            .split(".")
            .reduce((current, key) => current && current[key], obj)
    }

    private generateRequestId(): string {
        return `grpc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    onModuleDestroy() {
        // Close all gRPC clients
        for (const [serviceName, client] of this.clients.entries()) {
            try {
                client.close()
                this.logger.log(`gRPC client ${serviceName} closed`)
            } catch (error) {
                this.logger.warn(
                    `Failed to close gRPC client ${serviceName}:`,
                    error,
                )
            }
        }
    }
}
