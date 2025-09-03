// Base options interface
export interface BaseOptions {
  isGlobal?: boolean;
  useGlobalImports?: boolean;
}

import { UserSchema } from "../databases/prisma/schemas"

export type UserLike = Partial<UserSchema> & { id: string; refresh?: boolean };

export interface AuthCredentials {
  accessToken: string;
  refreshToken: RefreshToken;
}

export interface RefreshToken {
  token: string;
  expiredAt: Date;
}

export type JwtOptions = BaseOptions;

export enum AuthCredentialType {
  AccessToken = "accessToken",
  RefreshToken = "refreshToken",
}
