import { Injectable } from "@nestjs/common"
import { envConfig } from "@libs/env"
import { BadgeMilestone } from "../../../domain/entities/badge-milestone.model"

@Injectable()
export class BadgeMilestoneService {
    private readonly env = envConfig()

    getBadgeMilestones(): BadgeMilestone[] {
        return [
            {
                name: "Sao Kim Cương",
                badgeId: this.env.badge.diamondId,
                minAmount: "500000000",
                priority: 110,
                description: "Trao tặng khi quyên góp từ 500,000,000 VNĐ trở lên",
            },
            {
                name: "Sao Bạch Kim",
                badgeId: this.env.badge.platinumId,
                minAmount: "100000000",
                priority: 100,
                description: "Trao tặng khi quyên góp từ 100,000,000 VNĐ trở lên",
            },
            {
                name: "Sao Vàng",
                badgeId: this.env.badge.goldId,
                minAmount: "10000000",
                priority: 90,
                description: "Trao tặng khi quyên góp từ 10,000,000 VNĐ trở lên",
            },
            {
                name: "Sao Bạc",
                badgeId: this.env.badge.silverId,
                minAmount: "1000000",
                priority: 80,
                description: "Trao tặng khi quyên góp từ 1,000,000 VNĐ trở lên",
            },
            {
                name: "Sao Đồng",
                badgeId: this.env.badge.bronzeId,
                minAmount: "100000",
                priority: 70,
                description: "Trao tặng khi quyên góp từ 100,000 VNĐ trở lên",
            },
            {
                name: "Quyên Góp Đầu Tiên",
                badgeId: this.env.badge.firstDonationId,
                minAmount: "0",
                priority: 10,
                description: "Trao tặng khi thực hiện quyên góp đầu tiên",
            },
        ]
    }

    getMilestoneByBadgeId(badgeId: string): BadgeMilestone | null {
        const milestones = this.getBadgeMilestones()
        return milestones.find(m => m.badgeId === badgeId) || null
    }
}
