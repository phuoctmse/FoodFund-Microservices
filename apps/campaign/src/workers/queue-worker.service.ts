import { Injectable, OnModuleInit, Logger } from "@nestjs/common"
import { DonationProcessorService } from "../donation/services/donation-processor.service"

@Injectable()
export class QueueWorkerService implements OnModuleInit {
    private readonly logger = new Logger(QueueWorkerService.name)

    constructor(
        private readonly donationProcessorService: DonationProcessorService,
    ) {}

    async onModuleInit() {
        // Start queue consumers in background
        this.startWorkers()
    }

    private startWorkers() {
        // Start donation queue consumer
        this.startDonationWorker()
    }

    private startDonationWorker() {
        setImmediate(async () => {
            try {
                this.logger.log("Starting donation queue worker...")
                await this.donationProcessorService.startQueueConsumer()
            } catch (error) {
                this.logger.error("Donation queue worker crashed", error)
                // Restart after 10 seconds
                setTimeout(() => this.startDonationWorker(), 10000)
            }
        })
    }
}