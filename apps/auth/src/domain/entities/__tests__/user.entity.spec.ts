import { User } from "../user.entity"

describe("User Entity", () => {
    let user: User

    beforeEach(() => {
        user = new User(
            "user-123",
            "test@example.com",
            "testuser",
            "Test User",
            true, // isActive
            true, // emailVerified
            "cognito",
            new Date("2024-01-01"),
            new Date("2024-01-01"),
        )
    })

    describe("activate", () => {
        it("should activate an inactive user", () => {
            const inactiveUser = new User(
                "user-123",
                "test@example.com",
                "testuser",
                "Test User",
                false, // isActive
                true,
                "cognito",
                new Date(),
                new Date(),
            )

            inactiveUser.activate()

            expect(inactiveUser.isActive).toBe(true)
        })

        it("should throw error if user is already active", () => {
            expect(() => user.activate()).toThrow("User is already active")
        })
    })

    describe("deactivate", () => {
        it("should deactivate an active user", () => {
            user.deactivate()

            expect(user.isActive).toBe(false)
        })

        it("should throw error if user is already inactive", () => {
            user.deactivate()

            expect(() => user.deactivate()).toThrow("User is already inactive")
        })
    })

    describe("verifyEmail", () => {
        it("should verify an unverified email", () => {
            const unverifiedUser = new User(
                "user-123",
                "test@example.com",
                "testuser",
                "Test User",
                true,
                false, // emailVerified
                "cognito",
                new Date(),
                new Date(),
            )

            unverifiedUser.verifyEmail()

            expect(unverifiedUser.emailVerified).toBe(true)
        })

        it("should throw error if email is already verified", () => {
            expect(() => user.verifyEmail()).toThrow(
                "Email is already verified",
            )
        })
    })

    describe("canSignIn", () => {
        it("should return true if user is active and email is verified", () => {
            expect(user.canSignIn()).toBe(true)
        })

        it("should return false if user is inactive", () => {
            user.deactivate()

            expect(user.canSignIn()).toBe(false)
        })

        it("should return false if email is not verified", () => {
            const unverifiedUser = new User(
                "user-123",
                "test@example.com",
                "testuser",
                "Test User",
                true,
                false, // emailVerified
                "cognito",
                new Date(),
                new Date(),
            )

            expect(unverifiedUser.canSignIn()).toBe(false)
        })
    })

    describe("canChangePassword", () => {
        it("should return true if user is active", () => {
            expect(user.canChangePassword()).toBe(true)
        })

        it("should return false if user is inactive", () => {
            user.deactivate()

            expect(user.canChangePassword()).toBe(false)
        })
    })

    describe("getters", () => {
        it("should return correct isActive value", () => {
            expect(user.isActive).toBe(true)
        })

        it("should return correct emailVerified value", () => {
            expect(user.emailVerified).toBe(true)
        })

        it("should return correct id", () => {
            expect(user.id).toBe("user-123")
        })

        it("should return correct email", () => {
            expect(user.email).toBe("test@example.com")
        })

        it("should return correct username", () => {
            expect(user.username).toBe("testuser")
        })

        it("should return correct name", () => {
            expect(user.name).toBe("Test User")
        })

        it("should return correct provider", () => {
            expect(user.provider).toBe("cognito")
        })
    })
})
