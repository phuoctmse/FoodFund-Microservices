import { BadRequestException } from "@nestjs/common"
import { ValidationError } from "class-validator"

export class GraphQLValidationException extends BadRequestException {
    public readonly validationErrors: any[]

    constructor(errors: ValidationError[]) {
        const formattedErrors = GraphQLValidationException.formatErrors(errors)

        super({
            message: "Input validation failed",
            errors: formattedErrors,
            statusCode: 400,
        })

        this.validationErrors = formattedErrors
    }

    private static formatErrors(errors: ValidationError[]): any[] {
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
                const nestedErrors = GraphQLValidationException.formatErrors(
                    error.children,
                )
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
