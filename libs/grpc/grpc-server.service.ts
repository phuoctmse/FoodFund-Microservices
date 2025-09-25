import {
    Injectable,
    Logger,
    OnModuleInit,
    OnModuleDestroy,
} from "@nestjs/common"
import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import { SentryService } from "libs/observability/sentry.service"
import { join } from "path"

export interface GrpcServerConfig {
    port: number
    protoPath: string
    packageName: string
    serviceName: string
    implementation: any
}

export interface GrpcMethodHandler {
    (
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>,
    ): void
}

@Injectable()
export class GrpcServerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(GrpcServerService.name)
    private server: grpc.Server
    private config: GrpcServerConfig

    constructor(private readonly sentryService: SentryService) {
        this.server = new grpc.Server()
    }

    // Initialize gRPC server for a service
    async initialize(config: GrpcServerConfig): Promise<void> {
        this.config = config

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
            const serviceDefinition = packageObj[config.serviceName]

            if (!serviceDefinition || !serviceDefinition.service) {
                throw new Error(
                    `Service ${config.serviceName} not found in package ${config.packageName}`,
                )
            }

            // Wrap implementation methods with error handling and monitoring
            const wrappedImplementation = this.wrapImplementation(
                config.implementation,
            )

            // Add service to server
            this.server.addService(
                serviceDefinition.service,
                wrappedImplementation,
            )

            this.logger.log(`gRPC service ${config.serviceName} initialized`)
        } catch (error) {
            this.logger.error("Failed to initialize gRPC service:", error)
            throw error
        }
    }

    // Start the gRPC server
    async start(): Promise<void> {
        if (!this.config) {
            throw new Error(
                "gRPC server not initialized. Call initialize() first.",
            )
        }

        return new Promise((resolve, reject) => {
            const bindAddress = `0.0.0.0:${this.config.port}`

            this.server.bindAsync(
                bindAddress,
                grpc.ServerCredentials.createInsecure(),
                (error, port) => {
                    if (error) {
                        this.logger.error("Failed to start gRPC server:", error)
                        reject(error)
                        return
                    }

                    this.server.start()
                    this.logger.log(`gRPC server started on port ${port}`)
                    resolve()
                },
            )
        })
    }

    // Wrap implementation methods with monitoring and error handling
    private wrapImplementation(implementation: any): any {
        const wrapped = {}

        for (const [methodName, method] of Object.entries(implementation)) {
            if (typeof method === "function") {
                wrapped[methodName] = this.wrapMethod(
                    methodName,
                    method as Function,
                )
            }
        }

        return wrapped
    }

    private wrapMethod(
        methodName: string,
        originalMethod: Function,
    ): GrpcMethodHandler {
        return async (
            call: grpc.ServerUnaryCall<any, any>,
            callback: grpc.sendUnaryData<any>,
        ) => {
            const startTime = Date.now()
            const requestId = this.extractRequestId(call.metadata)
            const clientService =
                call.metadata.get("x-service-name")[0] || "unknown"

            // Add breadcrumb for tracking
            this.sentryService.addBreadcrumb(
                `gRPC method called: ${methodName}`,
                "grpc",
                {
                    methodName,
                    clientService,
                    requestId,
                },
            )

            try {
                this.logger.log(
                    `gRPC method called: ${methodName} from ${clientService}`,
                )

                // Call original method
                const result = await originalMethod(call, callback)

                const duration = Date.now() - startTime

                // Log successful call
                this.logger.log(
                    `gRPC method completed: ${methodName} (${duration}ms)`,
                )

                // Track slow methods
                if (duration > 2000) {
                    this.sentryService.captureMessage(
                        `Slow gRPC method: ${methodName} took ${duration}ms`,
                        "warning",
                        { methodName, duration, clientService },
                    )
                }

                return result
            } catch (error) {
                const duration = Date.now() - startTime

                this.logger.error(
                    `gRPC method failed: ${methodName} (${duration}ms)`,
                    error,
                )

                // Capture error with context
                this.sentryService.captureError(error as Error, {
                    grpcMethod: true,
                    methodName,
                    clientService,
                    requestId,
                    duration,
                    request: this.sanitizeRequest(call.request),
                })

                // Convert to gRPC error
                const grpcError = this.convertToGrpcError(error)
                callback(grpcError)
            }
        }
    }

    private convertToGrpcError(error: any): grpc.ServiceError {
        let code = grpc.status.INTERNAL
        const message = error.message || "Internal server error"

        // Map common errors to gRPC status codes
        if (
            error.name === "ValidationError" ||
            error.message?.includes("validation")
        ) {
            code = grpc.status.INVALID_ARGUMENT
        } else if (error.message?.includes("not found")) {
            code = grpc.status.NOT_FOUND
        } else if (error.message?.includes("already exists")) {
            code = grpc.status.ALREADY_EXISTS
        } else if (
            error.message?.includes("unauthorized") ||
            error.message?.includes("authentication")
        ) {
            code = grpc.status.UNAUTHENTICATED
        } else if (
            error.message?.includes("permission") ||
            error.message?.includes("forbidden")
        ) {
            code = grpc.status.PERMISSION_DENIED
        }

        const grpcError = new Error(message) as grpc.ServiceError
        grpcError.code = code
        grpcError.details = message

        return grpcError
    }

    private extractRequestId(metadata: grpc.Metadata): string {
        const requestIds = metadata.get("x-request-id")
        return requestIds.length > 0 ? requestIds[0].toString() : "unknown"
    }

    private sanitizeRequest(request: any): any {
        if (!request) return request

        // Remove sensitive fields
        const sensitiveFields = ["password", "token", "secret", "key"]
        const sanitized = { ...request }

        sensitiveFields.forEach((field) => {
            if (sanitized[field]) {
                sanitized[field] = "[REDACTED]"
            }
        })

        return sanitized
    }

    private getNestedProperty(obj: any, path: string): any {
        return path
            .split(".")
            .reduce((current, key) => current && current[key], obj)
    }

    // Health check method (should be implemented by all services)
    createHealthMethod() {
        return {
            Health: (
                call: grpc.ServerUnaryCall<any, any>,
                callback: grpc.sendUnaryData<any>,
            ) => {
                const response = {
                    status: "healthy",
                    service: this.config.serviceName,
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                }

                callback(null, response)
            },
        }
    }

    async onModuleInit() {
        // Server will be started by the specific service implementation
    }

    async onModuleDestroy() {
        if (this.server) {
            return new Promise<void>((resolve) => {
                this.server.tryShutdown((error) => {
                    if (error) {
                        this.logger.error(
                            "Error shutting down gRPC server:",
                            error,
                        )
                    } else {
                        this.logger.log("gRPC server shut down gracefully")
                    }
                    resolve()
                })
            })
        }
    }
}
