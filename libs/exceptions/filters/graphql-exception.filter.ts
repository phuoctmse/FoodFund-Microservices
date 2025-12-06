import { Catch, ArgumentsHost, Logger } from "@nestjs/common"
import { GqlArgumentsHost, GqlExceptionFilter } from "@nestjs/graphql"
import { GraphQLError } from "graphql"
import { BaseException } from "../base.exception"
import { SentryService } from "libs/observability/sentry.service"
import { GraphQLValidationException } from "libs/validation"

@Catch()
export class GraphQLExceptionFilter implements GqlExceptionFilter {
    private readonly logger = new Logger(GraphQLExceptionFilter.name)

    constructor(private readonly sentryService: SentryService) {}

    catch(exception: unknown, host: ArgumentsHost): GraphQLError {
        const { requestInfo, context, info, args } =
            this.extractRequestInfo(host)

        if (exception instanceof BaseException) {
            return this.handleBaseException(exception, requestInfo)
        }

        if (exception instanceof GraphQLValidationException) {
            return this.handleGraphQLValidationException(exception, requestInfo)
        }

        if (exception instanceof Error) {
            return this.handleErrorException(exception, requestInfo, args)
        }

        return this.handleUnknownException(exception, requestInfo)
    }

    private sanitizeVariables(
        variables: Record<string, any>,
    ): Record<string, any> {
        const sanitized = { ...variables }
        const sensitiveFields = [
            "password",
            "token",
            "accessToken",
            "refreshToken",
            "secret",
            "newPassword",
            "oldPassword",
        ]

        for (const field of sensitiveFields) {
            if (field in sanitized) {
                sanitized[field] = "***"
            }
        }
        return sanitized
    }

    private extractRequestInfo(host: ArgumentsHost) {
        const gqlHost = GqlArgumentsHost.create(host)
        const info = gqlHost.getInfo()
        const context = gqlHost.getContext()
        const args = gqlHost.getArgs()

        const requestInfo = {
            operation: info?.operation?.operation || "unknown",
            fieldName: info?.fieldName || "unknown",
            path: info?.path?.key || "unknown",
            variables: args || {},
            user: context?.req?.user,
            userAgent: context?.req?.headers?.["user-agent"],
            ip: context?.req?.ip,
        }
        return { requestInfo, context, info, args }
    }

    private handleBaseException(
        exception: BaseException,
        requestInfo: any,
    ): GraphQLError {
        this.logger.error(
            `${exception.service.toUpperCase()} Error [${exception.errorCode}]: ${exception.message}`,
            {
                errorType: exception.errorType,
                context: exception.context,
                operation: requestInfo.operation,
                fieldName: requestInfo.fieldName,
                path: requestInfo.path,
            },
        )

        this.sentryService.captureError(exception, {
            ...exception.toSentryContext(),
            graphql: {
                operation: requestInfo.operation,
                fieldName: requestInfo.fieldName,
                path: requestInfo.path,
                variables: this.sanitizeVariables(requestInfo.variables),
            },
            user: requestInfo.user
                ? {
                    id: requestInfo.user.id,
                    email: requestInfo.user.email,
                }
                : undefined,
        })

        this.sentryService.addBreadcrumb(
            `${exception.service} GraphQL Error: ${exception.errorCode}`,
            "error",
            {
                errorCode: exception.errorCode,
                errorType: exception.errorType,
                operation: requestInfo.operation,
                fieldName: requestInfo.fieldName,
            },
        )

        return new GraphQLError(exception.message, {
            extensions: {
                code: exception.errorCode,
                type: exception.errorType,
                service: exception.service,
                timestamp: new Date().toISOString(),
                ...(process.env.NODE_ENV === "development" && {
                    context: exception.context,
                    stack: exception.stack,
                }),
            },
        })
    }

    private handleGraphQLValidationException(
        exception: GraphQLValidationException,
        requestInfo: any,
    ): GraphQLError {
        this.logger.error(`GraphQL Validation Error: ${exception.message}`, {
            operation: requestInfo.operation,
            fieldName: requestInfo.fieldName,
            variables: this.sanitizeVariables(requestInfo.variables),
            validationErrors: exception.validationErrors,
        })

        return new GraphQLError("Input validation failed", {
            extensions: {
                code: "VALIDATION_ERROR",
                type: "VALIDATION",
                service: "validation",
                timestamp: new Date().toISOString(),
                details: exception.validationErrors,
            },
        })
    }

    private handleErrorException(
        exception: Error,
        requestInfo: any,
        args: any,
    ): GraphQLError {
        if (this.isValidationError(exception)) {
            const validationDetails = this.extractValidationDetails(exception)
            this.logger.error(
                `GraphQL Validation Error: ${exception.message}`,
                {
                    operation: requestInfo.operation,
                    fieldName: requestInfo.fieldName,
                    variables: this.sanitizeVariables(requestInfo.variables),
                },
            )

            return new GraphQLError("Input validation failed", {
                extensions: {
                    code: "VALIDATION_ERROR",
                    type: "VALIDATION",
                    service: "validation",
                    timestamp: new Date().toISOString(),
                    ...(validationDetails && { details: validationDetails }),
                    ...(process.env.NODE_ENV === "development" && {
                        originalMessage: exception.message,
                        stack: exception.stack,
                    }),
                },
            })
        } else {
            this.logger.error(`GraphQL Error: ${exception.message}`, {
                operation: requestInfo.operation,
                fieldName: requestInfo.fieldName,
                stack: exception.stack,
            })

            this.sentryService.captureError(exception, {
                graphql: {
                    operation: requestInfo.operation,
                    fieldName: requestInfo.fieldName,
                    path: requestInfo.path,
                    variables: this.sanitizeVariables(requestInfo.variables),
                },
                user: requestInfo.user,
            })

            return new GraphQLError(
                process.env.NODE_ENV === "development"
                    ? exception.message
                    : "Internal server error",
                {
                    extensions: {
                        code: "INTERNAL_ERROR",
                        type: "SYSTEM",
                        service: "graphql",
                        timestamp: new Date().toISOString(),
                        ...(process.env.NODE_ENV === "development" && {
                            originalMessage: exception.message,
                            stack: exception.stack,
                        }),
                    },
                },
            )
        }
    }

    private handleUnknownException(
        exception: unknown,
        requestInfo: any,
    ): GraphQLError {
        const errorMessage = String(exception)
        this.logger.error(`Unexpected GraphQL Error: ${errorMessage}`)

        this.sentryService.captureError(new Error(errorMessage), {
            graphql: {
                operation: requestInfo.operation,
                fieldName: requestInfo.fieldName,
                path: requestInfo.path,
            },
            user: requestInfo.user,
        })

        return new GraphQLError("Internal server error", {
            extensions: {
                code: "INTERNAL_ERROR",
                type: "SYSTEM",
                service: "graphql",
                timestamp: new Date().toISOString(),
                ...(process.env.NODE_ENV === "development" && {
                    originalError: errorMessage,
                }),
            },
        })
    }

    private isValidationError(exception: Error): boolean {
        return (
            exception.message.includes("Validation failed") ||
            exception.name === "BadRequestException"
        )
    }

    private extractValidationDetails(exception: any): any {
        try {
            if (exception.validationErrors) {
                return exception.validationErrors
            }
            const errorResponse = exception.response
            if (errorResponse && errorResponse.errors) {
                return errorResponse.errors
            }
            if (errorResponse && Array.isArray(errorResponse.message)) {
                return errorResponse.message.map(
                    (msg: string, index: number) => ({
                        field: "unknown",
                        message: msg,
                        constraint: "validation",
                        index,
                    }),
                )
            }
        } catch {
            // Ignore parsing errors
        }
        return null
    }
}
