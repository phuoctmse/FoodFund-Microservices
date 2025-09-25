import { ValidationPipe } from "@nestjs/common"
import { ValidationError } from "class-validator"
import { GraphQLValidationException } from "./graphql-validation.exception"

export class CustomValidationPipe extends ValidationPipe {
    constructor() {
        super({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
            exceptionFactory: (errors: ValidationError[]) => {
                return new GraphQLValidationException(errors)
            },
        })
    }

    private extractErrorMessages(errors: ValidationError[]): any[] {
        const formattedErrors: any[] = []

        errors.forEach((error) => {
            if (error.constraints) {
                // Add each constraint as a separate error for clarity
                Object.entries(error.constraints).forEach(
                    ([constraintKey, message]) => {
                        formattedErrors.push({
                            field: error.property,
                            value: error.value,
                            constraint: constraintKey,
                            message: message,
                        })
                    },
                )
            }

            // Handle nested validation errors
            if (error.children && error.children.length > 0) {
                const nestedErrors = this.extractErrorMessages(error.children)
                nestedErrors.forEach((nestedError) => {
                    formattedErrors.push({
                        ...nestedError,
                        field: `${error.property}.${nestedError.field}`,
                    })
                })
            }
        })

        return formattedErrors
    }
}
