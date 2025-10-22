import { Field, InputType } from "@nestjs/graphql"
import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    MinLength,
    Matches,
    IsEnum,
    MaxLength,
    Min,
} from "class-validator"
import { Transform } from "class-transformer"
import { IsStrongPassword, IsVietnamesePhone } from "libs/validation"

@InputType()
export class SignUpInput {
    @Field()
    @IsNotEmpty({ message: "Email is required" })
    @IsEmail({}, { message: "Please provide a valid email address" })
    @Transform(({ value }) => value?.toLowerCase().trim())
        email: string

    @Field()
    @IsNotEmpty({ message: "Password is required" })
    @MinLength(6, { message: "Password must be at least 6 characters long" })
    @MaxLength(100, { message: "Password must be at most 100 characters long"})
        password: string

    @Field()
    @IsString({ message: "Name must be a string" })
    @IsNotEmpty({ message: "Name is required" })
    @Transform(({ value }) => value?.trim())
        name: string

    @Field({ nullable: true })
    @IsOptional()
    @IsString({ message: "Phone number must be a string" })
    @IsVietnamesePhone({
        message: "Please provide a valid Vietnamese phone number",
    })
        phoneNumber?: string

    @Field({ nullable: true })
    @IsOptional()
    @IsString({ message: "Bio must be a string" })
    @Transform(({ value }) => value?.trim())
        bio: string
}

@InputType()
export class ConfirmSignUpInput {
    @Field()
    @IsEmail({}, { message: "Please provide a valid email address" })
    @Transform(({ value }) => value?.toLowerCase().trim())
        email: string

    @Field()
    @IsNotEmpty({ message: "Confirmation code is required" })
    @IsString({ message: "Confirmation code must be a string" })
    @Matches(/^\d{6}$/, { message: "Confirmation code must be 6 digits" })
        confirmationCode: string
}

@InputType()
export class SignInInput {
    @Field()
    @IsEmail({}, { message: "Please provide a valid email address" })
    @Transform(({ value }) => value?.toLowerCase().trim())
        email: string

    @Field()
    @IsNotEmpty({ message: "Password is required" })
    @IsString({ message: "Password must be a string" })
        password: string
}

@InputType()
export class ForgotPasswordInput {
    @Field()
    @IsEmail({}, { message: "Please provide a valid email address" })
    @Transform(({ value }) => value?.toLowerCase().trim())
        email: string
}

@InputType()
export class ConfirmForgotPasswordInput {
    @Field()
    @IsEmail({}, { message: "Please provide a valid email address" })
    @Transform(({ value }) => value?.toLowerCase().trim())
        email: string

    @Field()
    @IsNotEmpty({ message: "Confirmation code is required" })
    @IsString({ message: "Confirmation code must be a string" })
    @Matches(/^\d{6}$/, { message: "Confirmation code must be 6 digits" })
        confirmationCode: string

    @Field()
    @IsNotEmpty({ message: "New password is required" })
    @IsStrongPassword({ message: "Password must be strong" })
        newPassword: string
}

@InputType()
export class ResendCodeInput {
    @Field()
    @IsEmail({}, { message: "Please provide a valid email address" })
    @Transform(({ value }) => value?.toLowerCase().trim())
        email: string
}

@InputType()
export class VerifyTokenInput {
    @Field()
    @IsNotEmpty({ message: "Access token is required" })
    @IsString({ message: "Access token must be a string" })
        accessToken: string
}

@InputType()
export class GetUserInput {
    @Field()
    @IsNotEmpty({ message: "User ID is required" })
    @IsString({ message: "User ID must be a string" })
        userId: string
}

@InputType()
export class RefreshTokenInput {
    @Field()
    @IsNotEmpty({ message: "Refresh token is required" })
    @IsString({ message: "Refresh token must be a string" })
        refreshToken: string

    @Field()
    @IsNotEmpty({ message: "Email is required" })
    // @IsEmail({}, { message: "Please provide a valid email address" })
    // @Transform(({ value }) => value?.toLowerCase().trim())
        userName: string
}

@InputType()
export class UpdateUserInput {
    @Field({ nullable: true })
    @IsOptional()
    @IsString({ message: "Name must be a string" })
        name?: string

    @Field({ nullable: true })
    @IsOptional()
    @IsString({ message: "Phone number must be a string" })
        phoneNumber?: string
}

@InputType()
export class ChangePasswordInput {
    @Field()
    @IsNotEmpty({ message: "New password is required" })
    @IsStrongPassword({ message: "Password must be strong" })
        newPassword: string

    @Field()
    @IsNotEmpty({ message: "Confirm new password is required" })
    @IsString({ message: "Confirm new password must be a string" })
        confirmNewPassword: string
}

@InputType()
export class CheckCurrentPasswordInput {
    @Field()
    @IsNotEmpty({ message: "Current password is required" })
    @IsString({ message: "Current password must be a string" })
        currentPassword: string
}

@InputType()
export class GoogleAuthInput {
    @Field()
    @IsNotEmpty({ message: "Google ID token is required" })
    @IsString({ message: "Google ID token must be a string" })
        idToken: string
}
