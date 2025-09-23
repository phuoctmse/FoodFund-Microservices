import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
} from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import { GrpcClientService } from "libs/grpc"

// Định nghĩa enum cho role để tránh hardcode số
enum UserRole {
    DONOR = "DONOR",
    FUNDRAISER = "FUNDRAISER",
    KITCHEN_STAFF = "KITCHEN_STAFF",
    ADMIN = "ADMIN",
    DELIVERY_STAFF = "DELIVERY_STAFF",
}

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly grpcClient: GrpcClientService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Lấy request từ GraphQL context
        const request = this.getRequestFromGraphQLContext(context)

        // Lấy access token từ header Authorization
        const token = this.extractTokenFromHeader(request)
        if (!token) {
            throw new UnauthorizedException("No authorization token provided")
        }

        // Xác thực token với Auth service qua gRPC
        const authResponse = await this.verifyTokenWithAuthService(token)
        if (!authResponse.valid || !authResponse.user) {
            throw new UnauthorizedException("Invalid or expired token")
        }

        const user = authResponse.user

        // Lấy thông tin user từ User service để kiểm tra role
        const userDetails = await this.getUserRole(user.id)
        if (!userDetails || typeof userDetails.role !== "string") {
            throw new ForbiddenException("User role not found")
        }

        let isAdmin = false
        if (typeof userDetails.role === "string") {
            isAdmin = userDetails.role === UserRole.ADMIN
        } 

        if (!isAdmin) {
            throw new ForbiddenException("Admin access required")
        }

        // Gắn user vào request context để các resolver có thể sử dụng
        request.user = user
        request.userRole = userDetails.role

        return true
    }

    private getRequestFromGraphQLContext(context: ExecutionContext) {
        const gqlContext = GqlExecutionContext.create(context).getContext()
        if (!gqlContext || !gqlContext.req) {
            throw new UnauthorizedException("Request context not found")
        }
        return gqlContext.req
    }

    private extractTokenFromHeader(request: any): string | null {
        const authHeader = request.headers?.authorization
        if (
            typeof authHeader !== "string" ||
            !authHeader.startsWith("Bearer ")
        ) {
            return null
        }
        return authHeader.substring(7)
    }

    private async verifyTokenWithAuthService(token: string): Promise<any> {
        try {
            console.log(
                "AdminGuard: Calling Auth service ValidateToken with token:",
                token.substring(0, 20) + "...",
            )
            const result = await this.grpcClient.callAuthService(
                "ValidateToken",
                {
                    access_token: token,
                },
            )
            console.log("AdminGuard: Auth service response:", result)
            return result
        } catch (error) {
            console.error("AdminGuard: Auth service call failed:", error)
            throw new UnauthorizedException("Token verification failed")
        }
    }

    private async getUserRole(
        cognitoId: string,
    ): Promise<{ role: string } | null> {
        try {
            const response = await this.grpcClient.callUserService("GetUser", {
                id: cognitoId,
            })

            if (
                response.success &&
                response.user &&
                typeof response.user.role === "string"
            ) {
                return { role: response.user.role }
            }
            return null
        } catch (error) {
            // Log lỗi nội bộ, không trả về chi tiết cho client
            console.error("Failed to get user role:", error)
            return null
        }
    }
}
