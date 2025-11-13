import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common"
import { PostLikeRepository } from "../../repositories/post-like.repository"
import { PostRepository } from "../../repositories/post.repository"

@Injectable()
export class PostLikeService {
    private readonly logger = new Logger(PostLikeService.name)

    constructor(
        private readonly postLikeRepository: PostLikeRepository,
        private readonly postRepository: PostRepository,
    ) {}

    async likePost(postId: string, userId: string) {
        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new NotFoundException(
                `Post with ID ${postId} does not exists`,
            )
        }

        const alreadyLiked = await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )
        if (alreadyLiked) {
            throw new BadRequestException("You already liked this post")
        }

        const result = await this.postLikeRepository.likePost(postId, userId)

        return {
            success: true,
            message: "Liked",
            isLiked: true,
            likeCount: result.likeCount,
        }
    }

    async unlikePost(postId: string, userId: string) {
        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new NotFoundException(
                `Post with ID ${postId} does not exists`,
            )
        }

        const hasLiked = await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )
        if (!hasLiked) {
            throw new BadRequestException(
                "You have not already liked this post.",
            )
        }

        const result = await this.postLikeRepository.unlikePost(postId, userId)

        return {
            success: true,
            message: "Unliked",
            isLiked: false,
            likeCount: result.likeCount,
        }
    }

    async checkIfLiked(postId: string, userId: string): Promise<boolean> {
        return await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )
    }

    async getPostLikes(postId: string, limit: number = 20, offset: number = 0) {
        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new NotFoundException(`Post with ${postId} does not exists`)
        }

        return await this.postLikeRepository.getPostLikes(postId, limit, offset)
    }
}
