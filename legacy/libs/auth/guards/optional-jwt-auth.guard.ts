import { envConfig } from "@libs/env"
import {
    Injectable,
    CanActivate,
    ExecutionContext,
    Logger,
    OnModuleInit,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { GqlExecutionContext } from "@nestjs/graphql"
import * as jwt from "jsonwebtoken"
import { JwksClient } from "jwks-rsa"

interface CognitoTokenPayload {
    sub: string
    email?: string
    email_verified?: boolean
    "cognito:username": string
    "cognito:groups"?: string[]
    "custom:role"?: string
    iss: string
    aud: string
    token_use: "id" | "access"
    auth_time: number
    exp: number
    iat: number
}

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate, OnModuleInit {
    private readonly logger = new Logger(OptionalJwtAuthGuard.name)
    private jwksClient: JwksClient
    private issuer: string
    private appClientId?: string

    constructor() {}

    onModuleInit() {
        const env = envConfig()
        const region = env.aws.region
        const userPoolId = env.aws.cognito.userPoolId
        this.appClientId = env.aws.cognito.clientId

        if (!region || !userPoolId) {
            throw new Error(
                "AWS Cognito configuration missing. Set AWS_REGION and AWS_COGNITO_USER_POOL_ID",
            )
        }

        // AWS Cognito JWKS endpoint
        const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
        this.issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`

        this.jwksClient = new JwksClient({
            jwksUri,
            cache: true, // Cache signing keys for 10 hours
            cacheMaxAge: 36000000,
            rateLimit: true,
            jwksRequestsPerMinute: 10,
        })

        this.logger.log(`JWT verification initialized with JWKS: ${jwksUri}`)
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const gqlCtx = GqlExecutionContext.create(context)
        const req = gqlCtx.getContext().req

        await this.attachUserToRequest(req)

        // Always allow request to proceed (never block)
        return true
    }

    private async attachUserToRequest(req: any): Promise<void> {
        const authHeader =
            req.headers?.authorization || req.headers?.Authorization

        if (!this.hasValidAuthHeader(authHeader)) {
            req.user = null
            this.logger.debug(
                "No authorization token - treating as anonymous user",
            )
            return
        }

        const token = authHeader.substring(7)
        req.user = await this.validateAndGetUser(token)
    }

    private hasValidAuthHeader(authHeader: any): boolean {
        return (
            authHeader &&
            typeof authHeader === "string" &&
            authHeader.startsWith("Bearer ")
        )
    }

    private getKey(
        header: jwt.JwtHeader,
        callback: jwt.SigningKeyCallback,
    ): void {
        if (!header.kid) {
            return callback(new Error("Token is missing kid"), undefined)
        }
        this.jwksClient.getSigningKey(header.kid, (err, key) => {
            if (err) {
                return callback(err, undefined)
            }
            if (!key) {
                return callback(new Error("Signing key not found"), undefined)
            }
            const signingKey = key.getPublicKey()
            callback(null, signingKey)
        })
    }

    private async validateAndGetUser(token: string): Promise<any> {
        try {
            // Pre-parse header to enforce presence of kid and RS256
            const decodedHeader = jwt.decode(token, { complete: true }) as {
                header?: jwt.JwtHeader
            } | null
            if (!decodedHeader?.header) {
                this.logger.warn("Invalid JWT: missing header")
                return null
            }
            if (decodedHeader.header.alg !== "RS256") {
                this.logger.warn(`Invalid JWT alg: ${decodedHeader.header.alg}`)
                return null
            }
            if (!decodedHeader.header.kid) {
                this.logger.warn("Invalid JWT: missing kid")
                return null
            }

            const decoded = await new Promise<CognitoTokenPayload>(
                (resolve, reject) => {
                    jwt.verify(
                        token,
                        this.getKey.bind(this),
                        {
                            algorithms: ["RS256"],
                            issuer: this.issuer,
                        },
                        (err, decoded) => {
                            if (err) {
                                return reject(
                                    err instanceof Error
                                        ? err
                                        : new Error(String(err)),
                                )
                            }
                            resolve(decoded as CognitoTokenPayload)
                        },
                    )
                },
            )

            // Issue validation
            if (decoded.iss !== this.issuer) {
                this.logger.warn(`Invalid issuer: ${decoded.iss}`)
                return null
            }
            // Audience/client validation for ID/access tokens
            const audience = (decoded as any).aud || (decoded as any).client_id
            if (this.appClientId && audience !== this.appClientId) {
                this.logger.warn(`Invalid audience/client: ${audience}`)
            }
            // Restrict token_use if required
            if (decoded.token_use !== "id" && decoded.token_use !== "access") {
                this.logger.warn(`Invalid token_use: ${decoded.token_use}`)
                return null
            }

            const user = {
                sub: decoded.sub,
                username: decoded["cognito:username"],
                email: decoded.email,
                email_verified: decoded.email_verified,
                role: decoded["custom:role"],
                groups: decoded["cognito:groups"] || [],
                attributes: {
                    email: decoded.email,
                    role: decoded["custom:role"],
                },
            }
            this.logger.debug(
                `Authenticated user: ${user.email || user.username}`,
            )
            return user
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                this.logger.debug("Token has expired")
            } else if (error instanceof jwt.JsonWebTokenError) {
                this.logger.warn(`JWT validation failed: ${error.message}`)
            } else {
                this.logger.warn(
                    `Token validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
                )
            }
            return null
        }
    }
}
