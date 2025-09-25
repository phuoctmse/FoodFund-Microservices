import { Injectable, Logger } from "@nestjs/common"
import { JwtService as NestJwtService } from "@nestjs/jwt"
import { AuthCredentials, UserLike } from "./jwt.types"
import { v4 } from "uuid"
import ms, { StringValue } from "ms"
import { envConfig } from "../env"

@Injectable()
export class JwtService {
    private readonly logger = new Logger(JwtService.name)

    constructor(private readonly jwtService: NestJwtService) {}

    public async generateAuthCredentials(
        payload: UserLike,
    ): Promise<AuthCredentials> {
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: envConfig().jwt.secret,
                expiresIn: envConfig().jwt.accessTokenExpiration,
            }),
            v4(),
        ])
        return {
            accessToken,
            refreshToken: {
                token: refreshToken,
                expiredAt: await this.getExpiredAt(),
            },
        }
    }

    public async verifyToken(token: string): Promise<UserLike | null> {
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: envConfig().jwt.secret,
            })

            if (payload && typeof payload === "object" && payload.id) {
                return payload as UserLike
            }
            return null
        } catch (ex) {
            this.logger.error(ex)
            return null
        }
    }

    public async decodeToken(token: string): Promise<UserLike | null> {
        try {
            const decoded = this.jwtService.decode(token)
            if (decoded && typeof decoded === "object" && decoded.id) {
                return decoded as UserLike
            }
            return null
        } catch (ex) {
            this.logger.error(ex)
            return null
        }
    }

    private async getExpiredAt(): Promise<Date> {
        try {
            const expiresIn = envConfig().jwt.refreshTokenExpiration
            const expiresInMs = ms(expiresIn as StringValue)
            const now = new Date()
            return new Date(now.getTime() + expiresInMs)
        } catch (ex) {
            this.logger.error(
                "Failed to get expiration time from token",
                ex.message,
            )
            // Return default expiration (30 days from now)
            const now = new Date()
            return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        }
    }
}
