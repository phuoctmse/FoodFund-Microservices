import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import axios, { AxiosInstance } from "axios"

export interface BankInfo {
    id: number
    name: string
    code: string
    bin: string
    shortName: string
    logo: string
    transferSupported: number
    lookupSupported: number
}

export interface VietQRBanksResponse {
    code: string
    desc: string
    data: BankInfo[]
}

@Injectable()
export class VietQRService implements OnModuleInit {
    private readonly logger = new Logger(VietQRService.name)
    private readonly client: AxiosInstance
    private readonly banksCache: Map<string, BankInfo> = new Map()
    private lastFetchTime: number = 0
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

    constructor() {
        this.client = axios.create({
            baseURL: "https://api.vietqr.io/v2",
            timeout: 10000,
        })
    }

    async onModuleInit() {
        // Load banks on startup
        await this.loadBanks()
    }

    /**
     * Get bank name by BIN code
     * Returns formatted name like "Ngân hàng Quân đội (MB)"
     */
    async getBankNameByBin(bin: string): Promise<string | null> {
        // Check if cache needs refresh
        const now = Date.now()
        if (now - this.lastFetchTime > this.CACHE_TTL) {
            await this.loadBanks()
        }

        const bank = this.banksCache.get(bin)
        if (!bank) {
            this.logger.warn(`Bank not found for BIN: ${bin}`)
            return null
        }

        // Format: "Ngân hàng Quân đội (MB)"
        return `${bank.name} (${bank.shortName})`
    }

    /**
     * Get full bank info by BIN code
     */
    async getBankInfoByBin(bin: string): Promise<BankInfo | null> {
        const now = Date.now()
        if (now - this.lastFetchTime > this.CACHE_TTL) {
            await this.loadBanks()
        }

        return this.banksCache.get(bin) || null
    }

    /**
     * Load banks from VietQR API and cache in memory
     */
    private async loadBanks(): Promise<void> {
        try {
            this.logger.log("Loading banks from VietQR API...")

            const response =
                await this.client.get<VietQRBanksResponse>("/banks")

            if (response.data.code === "00" && response.data.data) {
                // Clear old cache
                this.banksCache.clear()

                // Build new cache
                for (const bank of response.data.data) {
                    this.banksCache.set(bank.bin, bank)
                }

                this.lastFetchTime = Date.now()
                this.logger.log(
                    `Loaded ${this.banksCache.size} banks into cache`,
                )
            } else {
                this.logger.error(
                    "Failed to load banks from VietQR API",
                    response.data,
                )
            }
        } catch (error) {
            this.logger.error("Error loading banks from VietQR API", {
                error: error instanceof Error ? error.message : error,
            })

            // If cache is empty and API fails, use fallback data
            if (this.banksCache.size === 0) {
                this.loadFallbackBanks()
            }
        }
    }

    /**
     * Fallback bank data in case API is unavailable
     * Contains most common Vietnamese banks
     */
    private loadFallbackBanks(): void {
        this.logger.warn("Using fallback bank data")

        const fallbackBanks: BankInfo[] = [
            {
                id: 17,
                name: "Ngân hàng TMCP Quân đội",
                code: "MB",
                bin: "970422",
                shortName: "MBBank",
                logo: "",
                transferSupported: 1,
                lookupSupported: 1,
            },
            {
                id: 43,
                name: "Ngân hàng TMCP Kỹ thương Việt Nam",
                code: "TCB",
                bin: "970407",
                shortName: "Techcombank",
                logo: "",
                transferSupported: 1,
                lookupSupported: 1,
            },
            {
                id: 4,
                name: "Ngân hàng TMCP Á Châu",
                code: "ACB",
                bin: "970416",
                shortName: "ACB",
                logo: "",
                transferSupported: 1,
                lookupSupported: 1,
            },
            {
                id: 38,
                name: "Ngân hàng TMCP Sài Gòn Thương Tín",
                code: "STB",
                bin: "970403",
                shortName: "Sacombank",
                logo: "",
                transferSupported: 1,
                lookupSupported: 1,
            },
            {
                id: 53,
                name: "Ngân hàng TMCP Ngoại Thương Việt Nam",
                code: "VCB",
                bin: "970436",
                shortName: "Vietcombank",
                logo: "",
                transferSupported: 1,
                lookupSupported: 1,
            },
            {
                id: 26,
                name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
                code: "BIDV",
                bin: "970418",
                shortName: "BIDV",
                logo: "",
                transferSupported: 1,
                lookupSupported: 1,
            },
            {
                id: 50,
                name: "Ngân hàng TMCP Việt Nam Thịnh Vượng",
                code: "VPB",
                bin: "970432",
                shortName: "VPBank",
                logo: "",
                transferSupported: 1,
                lookupSupported: 1,
            },
            {
                id: 37,
                name: "Ngân hàng TMCP Sài Gòn - Hà Nội",
                code: "SHB",
                bin: "970443",
                shortName: "SHB",
                logo: "",
                transferSupported: 1,
                lookupSupported: 1,
            },
        ]

        for (const bank of fallbackBanks) {
            this.banksCache.set(bank.bin, bank)
        }

        this.lastFetchTime = Date.now()
        this.logger.log(`Loaded ${fallbackBanks.length} fallback banks`)
    }

    /**
     * Get all cached banks
     */
    getAllBanks(): BankInfo[] {
        return Array.from(this.banksCache.values())
    }

    /**
     * Force refresh cache
     */
    async refreshCache(): Promise<void> {
        await this.loadBanks()
    }
}
