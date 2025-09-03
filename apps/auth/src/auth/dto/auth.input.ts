// apps/auth/src/auth/dto/auth.input.ts - Mở rộng
import { Field, InputType } from "@nestjs/graphql"

@InputType()
export class SignUpInput {
  @Field()
      email: string

  @Field()
      password: string

  @Field({ nullable: true })
      name?: string

  @Field({ nullable: true })
      phoneNumber?: string
}

@InputType()
export class ConfirmSignUpInput {
  @Field()
      email: string

  @Field()
      confirmationCode: string
}

@InputType()
export class SignInInput {
  @Field()
      email: string

  @Field()
      password: string
}

@InputType()
export class ForgotPasswordInput {
  @Field()
      email: string
}

@InputType()
export class ConfirmForgotPasswordInput {
  @Field()
      email: string

  @Field()
      confirmationCode: string

  @Field()
      newPassword: string
}

@InputType()
export class ResendCodeInput {
  @Field()
      email: string
}

// Existing inputs...
@InputType()
export class VerifyTokenInput {
  @Field()
      accessToken: string
}

@InputType()
export class GetUserInput {
  @Field()
      userId: string
}
