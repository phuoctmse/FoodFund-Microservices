import { Logger } from "@nestjs/common"

export interface SagaStep<T = any> {
    name: string
    execute: () => Promise<T>
    compensate?: () => Promise<void>
    retryConfig?: {
        maxRetries?: number
        backoffMs?: number
    }
}

export interface SagaOptions {
    logger?: Logger
    onStepComplete?: (stepName: string, result: any) => void
    onStepFailed?: (stepName: string, error: any) => void
    onCompensationComplete?: (stepName: string) => void
    onCompensationFailed?: (stepName: string, error: any) => void
}

export class SagaOrchestrator {
    private readonly steps: SagaStep[] = []
    private readonly completedSteps: Array<{ step: SagaStep; result: any }> = []
    private readonly logger: Logger

    constructor(
        private readonly sagaName: string,
        private readonly options?: SagaOptions,
    ) {
        this.logger = options?.logger || new Logger(SagaOrchestrator.name)
    }

    /**
     * Add a step to the saga
     */
    addStep<T>(step: SagaStep<T>): this {
        this.steps.push(step)
        return this
    }

    /**
     * Execute all saga steps with automatic compensation on failure
     */
    async execute<T = any>(): Promise<T> {
        this.logger.log(`[SAGA] Starting: ${this.sagaName}`)

        try {
            for (const step of this.steps) {
                const result = await this.executeStepWithRetry(step)
                this.completedSteps.push({ step, result })
            }

            this.logger.log(`[SAGA] COMPLETED: ${this.sagaName}`)
            return this.completedSteps[this.completedSteps.length - 1]?.result
        } catch (error) {
            this.logger.error(
                `[SAGA] FAILED: ${this.sagaName} - ${error instanceof Error ? error.message : error}`,
            )

            // Compensate in reverse order
            await this.compensate()

            throw error
        }
    }

    /**
     * Execute a single step with retry logic
     */
    private async executeStepWithRetry<T>(step: SagaStep<T>): Promise<T> {
        const maxRetries = step.retryConfig?.maxRetries || 1
        const backoffMs = step.retryConfig?.backoffMs || 1000

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const attemptInfo = maxRetries > 1 
                    ? ` (attempt ${attempt}/${maxRetries})` 
                    : ""
                this.logger.log(
                    `[SAGA] Executing step: ${step.name}${attemptInfo}`,
                )

                const result = await step.execute()

                this.logger.log(`[SAGA] Step completed: ${step.name}`)
                this.options?.onStepComplete?.(step.name, result)

                return result
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error)

                if (attempt === maxRetries) {
                    this.logger.error(
                        `[SAGA] Step failed after ${maxRetries} attempts: ${step.name}`,
                        { error: errorMessage },
                    )
                    this.options?.onStepFailed?.(step.name, error)
                    throw error
                }

                // Wait before retry (exponential backoff)
                const delayMs = Math.pow(2, attempt - 1) * backoffMs
                this.logger.warn(
                    `[SAGA] Step attempt ${attempt} failed: ${step.name}, retrying in ${delayMs}ms...`,
                )
                await this.delay(delayMs)
            }
        }

        throw new Error(`Unexpected: Step ${step.name} failed to execute`)
    }

    /**
     * Compensate all completed steps in reverse order
     */
    private async compensate(): Promise<void> {
        if (this.completedSteps.length === 0) {
            this.logger.log(
                `[SAGA ROLLBACK] No steps to compensate for: ${this.sagaName}`,
            )
            return
        }

        this.logger.warn(
            `[SAGA ROLLBACK] Starting compensation for ${this.completedSteps.length} completed steps`,
        )

        // Compensate in reverse order
        for (let i = this.completedSteps.length - 1; i >= 0; i--) {
            const { step } = this.completedSteps[i]

            if (!step.compensate) {
                this.logger.debug(
                    `[SAGA ROLLBACK] No compensation defined for step: ${step.name}`,
                )
                continue
            }

            try {
                this.logger.log(
                    `[SAGA ROLLBACK] Compensating step: ${step.name}`,
                )
                await step.compensate()
                this.logger.log(
                    `[SAGA ROLLBACK] Compensation successful: ${step.name}`,
                )
                this.options?.onCompensationComplete?.(step.name)
            } catch (compensationError) {
                // Log critical error but continue with other compensations
                this.logger.error(
                    `[SAGA ROLLBACK] CRITICAL: Compensation failed for step: ${step.name}`,
                    {
                        error:
                            compensationError instanceof Error
                                ? compensationError.message
                                : compensationError,
                        severity: "CRITICAL",
                        action: "MANUAL_INTERVENTION_REQUIRED",
                    },
                )
                this.options?.onCompensationFailed?.(
                    step.name,
                    compensationError,
                )
            }
        }

        this.logger.warn(
            `[SAGA ROLLBACK] Compensation completed for: ${this.sagaName}`,
        )
    }

    /**
     * Delay helper for retry mechanism
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
