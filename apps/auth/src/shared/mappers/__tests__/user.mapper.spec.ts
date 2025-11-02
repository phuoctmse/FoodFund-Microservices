import { UserMapper } from "../user.mapper"
import { User } from "../../../domain/entities/user.entity"

describe("UserMapper", () => {
    let mapper: UserMapper

    beforeEach(() => {
        mapper = new UserMapper()
    })

    describe("toDomain", () => {
        it("should map provider user to domain entity", () => {
            const providerUser = {
                sub: "cognito-123",
                email: "test@example.com",
                emailVerified: true,
                username: "testuser",
                name: "Test User",
            }

            const result = mapper.toDomain(providerUser)

            expect(result).toBeInstanceOf(User)
            expect(result.id).toBe("cognito-123")
            expect(result.email).toBe("test@example.com")
            expect(result.emailVerified).toBe(true)
            expect(result.username).toBe("testuser")
            expect(result.name).toBe("Test User")
            expect(result.provider).toBe("cognito")
            expect(result.isActive).toBe(true)
        })

        it("should handle unverified email", () => {
            const providerUser = {
                sub: "cognito-123",
                email: "test@example.com",
                emailVerified: false,
                username: "testuser",
                name: "Test User",
            }

            const result = mapper.toDomain(providerUser)

            expect(result.emailVerified).toBe(false)
        })
    })

    describe("toGraphQL", () => {
        it("should map domain entity to GraphQL format", () => {
            const user = new User(
                "user-123",
                "test@example.com",
                "testuser",
                "Test User",
                true,
                true,
                "cognito",
                new Date("2024-01-01"),
                new Date("2024-01-01"),
            )

            const result = mapper.toGraphQL(user)

            expect(result).toEqual({
                id: "user-123",
                email: "test@example.com",
                username: "testuser",
                name: "Test User",
                emailVerified: true,
                provider: "cognito",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
            })
        })
    })
})
