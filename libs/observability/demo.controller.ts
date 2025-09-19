import { Controller, Get, Post, Body, Param } from "@nestjs/common"
import { SentryService } from "./sentry.service"

@Controller("demo")
export class DemoController {
    constructor(private sentryService: SentryService) {}

    @Get("error")
    testError() {
        throw new Error("🚨 This is a test error for graduation demo!")
    }

    @Get("slow")
    async testSlowRequest() {
        // Simulate slow operation
        await new Promise((resolve) => setTimeout(resolve, 2000))
        return { message: "This was a slow request (2 seconds)" }
    }

    @Post("user-action")
    testUserAction(@Body() body: { userId: string; action: string }) {
        // Set user context
        this.sentryService.setUser({
            id: body.userId,
            username: `user_${body.userId}`,
        })

        // Add breadcrumb
        this.sentryService.addBreadcrumb(
            `User performed action: ${body.action}`,
            "user",
            { userId: body.userId, action: body.action },
        )

        return { message: "User action tracked in Sentry!" }
    }

    @Get("performance/:operation")
    async testPerformance(@Param("operation") operation: string) {
        return this.sentryService.capturePerformance(
            `demo-${operation}`,
            "test",
            async () => {
                // Simulate different operations
                const delay =
                    operation === "fast"
                        ? 100
                        : operation === "medium"
                            ? 500
                            : 1500
                await new Promise((resolve) => setTimeout(resolve, delay))

                return {
                    operation,
                    delay,
                    message: `${operation} operation completed`,
                }
            },
        )
    }

    @Get("custom-error/:type")
    testCustomError(@Param("type") type: string) {
        const errors = {
            validation: new Error("Validation failed: Email is required"),
            database: new Error("Database connection timeout"),
            auth: new Error("Authentication failed: Invalid token"),
            business: new Error("Business logic error: Insufficient funds"),
        }

        const error = errors[type] || new Error("Unknown error type")

        this.sentryService.captureError(error, {
            errorType: type,
            service: "auth-service",
            timestamp: new Date().toISOString(),
            additionalContext: {
                userAgent: "Demo Browser",
                feature: "error-testing",
            },
        })

        throw error
    }

    @Get("info")
    getDemoInfo() {
        return {
            message: "🎓 Sentry Demo Endpoints for Graduation Project",
            endpoints: [
                "GET /demo/error - Test basic error tracking",
                "GET /demo/slow - Test performance monitoring (slow request)",
                "POST /demo/user-action - Test user context tracking",
                "GET /demo/performance/:operation - Test performance monitoring (fast/medium/slow)",
                "GET /demo/custom-error/:type - Test different error types (validation/database/auth/business)",
            ],
            instructions: [
                "1. Call these endpoints to generate test data",
                "2. Check your Sentry dashboard to see real-time tracking",
                "3. Perfect for demonstrating monitoring capabilities!",
            ],
            sentryFeatures: [
                "✅ Real-time error tracking",
                "✅ Performance monitoring",
                "✅ User context tracking",
                "✅ Custom error categorization",
                "✅ Request breadcrumbs",
            ],
        }
    }
}
