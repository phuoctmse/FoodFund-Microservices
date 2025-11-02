/**
 * Application DTOs: Sign Up
 */

export class SignUpDto {
    email: string
    password: string
    name: string
}

export class SignUpResponseDto {
    userSub: string
    message: string
    emailSent: boolean
}
