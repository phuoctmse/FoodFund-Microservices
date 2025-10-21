import { Injectable, Logger } from "@nestjs/common"
import { CloudWatch, StandardUnit } from "@aws-sdk/client-cloudwatch"
import { envConfig, isProduction } from "@libs/env"

@Injectable()
export class CloudWatchMetricsService {
    private readonly logger = new Logger(CloudWatchMetricsService.name)
    private cloudwatch: CloudWatch | null = null
    private namespace: string
    private enabled: boolean

    constructor() {
        const config = envConfig()
        this.namespace = config.aws.cloudwatch.namespace
        this.enabled = isProduction() && !!config.aws.region

        if (this.enabled) {
            this.cloudwatch = new CloudWatch({
                region: config.aws.region,
            })
            this.logger.log(
                `CloudWatch Metrics enabled for namespace: ${this.namespace}`,
            )
        } else {
            this.logger.warn(
                "CloudWatch Metrics disabled (not in production or AWS_REGION not set)",
            )
        }
    }

    async putMetric(
        metricName: string,
        value: number,
        unit: StandardUnit = StandardUnit.Count,
    ): Promise<void> {
        if (!this.enabled || !this.cloudwatch) {
            this.logger.debug(`[Metrics] ${metricName}: ${value} ${unit}`)
            return
        }

        try {
            await this.cloudwatch.putMetricData({
                Namespace: this.namespace,
                MetricData: [
                    {
                        MetricName: metricName,
                        Value: value,
                        Unit: unit,
                        Timestamp: new Date(),
                        Dimensions: [
                            {
                                Name: "Environment",
                                Value: "production",
                            },
                        ],
                    },
                ],
            })
        } catch (error) {
            this.logger.error(
                `Failed to put CloudWatch metric: ${error.message}`,
            )
            throw error
        }
    }

    async incrementCounter(metricName: string): Promise<void> {
        await this.putMetric(metricName, 1, StandardUnit.Count)
    }

    async recordDuration(
        metricName: string,
        milliseconds: number,
    ): Promise<void> {
        await this.putMetric(metricName, milliseconds, StandardUnit.Milliseconds)
    }

    async recordValue(metricName: string, value: number): Promise<void> {
        await this.putMetric(metricName, value, StandardUnit.None)
    }
}
