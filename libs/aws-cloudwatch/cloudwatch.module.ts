import { Module, Global } from "@nestjs/common"
import { CloudWatchLoggerService } from "./cloudwatch-logger.service"
import { CloudWatchMetricsService } from "./cloudwatch-metrics.service"

@Global()
@Module({
    providers: [CloudWatchLoggerService, CloudWatchMetricsService],
    exports: [CloudWatchLoggerService, CloudWatchMetricsService],
})
export class CloudWatchModule {}
