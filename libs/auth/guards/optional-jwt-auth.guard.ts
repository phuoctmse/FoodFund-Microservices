import { Injectable, CanActivate, ExecutionContext, Logger } from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import { GrpcClientService } from "libs/grpc"

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
    private readonly logger = new Logger(OptionalJwtAuthGuard.name)

    constructor(private readonly grpcClient: GrpcClientService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const gqlCtx = GqlExecutionContext.create(context)
        const req = gqlCtx.getContext().req

        // Extract token from Authorization header
        const authHeader = req.headers?.authorization || req.headers?.Authorization
        
        if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
            // No token provided - treat as anonymous
            req.user = null
            this.logger.debug("No authorization token - treating as anonymous user")
            return true
        }

        const token = authHeader.substring(7)

        try {
            // Validate token with Auth Service via gRPC
            const authResponse = await this.grpcClient.callAuthService(
                "ValidateToken",
                { access_token: token },
            )

            if (authResponse.valid && authResponse.user) {
                // Token is valid - attach user to context
                req.user = authResponse.user
                this.logger.debug(`Authenticated user: ${authResponse.user.attributes?.email || "unknown"}`)
            } else {
                // Token validation failed - treat as anonymous
                req.user = null
                this.logger.warn("Token validation failed - treating as anonymous user")
            }
        } catch (error) {
            // Auth service call failed or token is invalid - treat as anonymous
            req.user = null
            this.logger.warn(
                `Token validation error: ${error instanceof Error ? error.message : "Unknown error"} - treating as anonymous user`,
            )
        }

        // Always allow request to proceed (never block)
        return true
    }
}
