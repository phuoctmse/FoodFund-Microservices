import { PostLikeJob } from "@app/campaign/src/domain/interfaces/post"
import { JOB_TYPES, QUEUE_NAMES } from "@libs/queue"
import { InjectQueue } from "@nestjs/bull"
import { Injectable } from "@nestjs/common"
import { Queue } from "bull"

@Injectable()
export class PostLikeQueue {
    constructor(
        @InjectQueue(QUEUE_NAMES.CAMPAIGN_JOBS)
        private readonly queue: Queue,
    ) {}

    async addLikeJob(data: PostLikeJob): Promise<string> {
        const job = await this.queue.add(JOB_TYPES.POST_LIKE, data, {
            priority: 1,
            attempts: 3,
            jobId: `${data.action}:${data.postId}:${data.userId}:${data.timestamp}`,
        })
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
