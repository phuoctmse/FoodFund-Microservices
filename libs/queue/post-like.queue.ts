import { InjectQueue } from "@nestjs/bull"
import { Injectable, Logger } from "@nestjs/common"
import { Queue } from "bull"
import { QUEUE_NAMES } from "./constants"
import { PostLikeJob } from "./types"

@Injectable()
export class PostLikeQueue {
    private readonly logger = new Logger(PostLikeQueue.name)

    constructor(
        @InjectQueue(QUEUE_NAMES.POST_LIKES) private queue: Queue<PostLikeJob>,
    ) {}

    async addLikeJob(data: PostLikeJob): Promise<string> {
        const job = await this.queue.add("process-like", data, {
            priority: 1,
            attempts: 3,
            jobId: `${data.action}:${data.postId}:${data.userId}:${data.timestamp}`,
        })

        this.logger.debug(`Added like job: ${job.id}`)
        return job.id.toString()
    }

    async getJobCounts() {
        return {
            waiting: await this.queue.getWaitingCount(),
            active: await this.queue.getActiveCount(),
            completed: await this.queue.getCompletedCount(),
            failed: await this.queue.getFailedCount(),
            delayed: await this.queue.getDelayedCount(),
        }
    }

    getQueue(): Queue<PostLikeJob> {
        return this.queue
    }
}
