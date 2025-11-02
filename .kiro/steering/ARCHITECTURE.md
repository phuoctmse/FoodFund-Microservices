# 🏗️ FoodFund Microservices - System Architecture

## 📋 Table of Contents

1. [Overview](#overview)
2. [Clean Architecture (4 Layers)](#clean-architecture-4-layers)
3. [Microservices Structure](#microservices-structure)
4. [Auth Service Architecture](#auth-service-architecture)
5. [Coding Standards](#coding-standards)
6. [Testing Strategy](#testing-strategy)
7. [Deployment](#deployment)

---

## Overview

**FoodFund** là một hệ thống microservices được xây dựng với **NestJS**, **GraphQL Federation**, và **Clean Architecture**.

### Tech Stack

- **Backend**: NestJS, TypeScript
- **API**: GraphQL (Apollo Federation), gRPC, REST
- **Database**: PostgreSQL
- **Authentication**: AWS Cognito
- **Message Queue**: gRPC
- **Observability**: Sentry
- **Testing**: Jest

---

## Clean Architecture (4 Layers)

Tất cả microservices đều follow **Clean Architecture** với 4 layers:

```
┌─────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                     │
│  • GraphQL Resolvers                                    │
│  • gRPC Controllers                                     │
│  • HTTP Controllers                                     │
│  • Request/Response validation                          │
└────────────────────┬────────────────────────────────────┘
                     │ DTOs
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                      │
│  • Business Logic Services                              │
│  • Use Cases                                            │
│  • Orchestration                                        │
│  • Transaction Management                               │
└────────────────────┬────────────────────────────────────┘
                     │ Domain Entities
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                         │
│  • Entities (Business Rules)                            │
│  • Interfaces (Contracts)                               │
│  • Domain Exceptions                                    │
│  • Value Objects                                        │
└────────────────────▲────────────────────────────────────┘
                     │ Implements Interfaces
                     │
┌────────────────────┴────────────────────────────────────┐
│                INFRASTRUCTURE LAYER                     │
│  • Database Repositories                                │
│  • External API Clients (AWS, gRPC)                     │
│  • Message Queues                                       │
│  • File Storage                                         │
└─────────────────────────────────────────────────────────┘
```

### Dependency Rules

1. **Presentation** → depends on → **Application**
2. **Application** → depends on → **Domain** (interfaces only)
3. **Infrastructure** → implements → **Domain** (interfaces)
4. **Domain** → depends on → **NOTHING** (pure business logic)

---

## Microservices Structure

### Services

```
apps/
├── auth/           # Authentication & Authorization
├── user/           # User Management
├── campaign/       # Campaign & Donation Management
└── gateway/        # API Gateway (Apollo Federation)
```

### Shared Libraries

```
libs/
├── aws-cognito/    # AWS Cognito integration
├── grpc/           # gRPC client/server
├── graphql/        # GraphQL utilities
├── auth/           # Auth guards & decorators
├── env/            # Environment configuration
├── observability/  # Sentry, logging
├── validation/     # Custom validators
└── common/         # Shared utilities
```

---

## Auth Service Architecture

### Folder Structure

```
apps/auth/src/
├── app.module.ts                    # Main module (all-in-one)
│
├── presentation/                    # Layer 1: Presentation
│   ├── graphql/
│   │   ├── resolvers/              # GraphQL resolvers
│   │   │   └── auth.resolver.ts
│   │   ├── models/                 # GraphQL types
│   │   │   ├── auth-user.model.ts
│   │   │   ├── sign-in-response.model.ts
│   │   │   └── ...
│   │   └── inputs/                 # GraphQL inputs
│   │       ├── sign-in.input.ts
│   │       ├── sign-up.input.ts
│   │       └── ...
│   ├── grpc/
│   │   └── controllers/            # gRPC controllers
│   │       └── auth-grpc.controller.ts
│   └── http/
│       └── controllers/            # HTTP controllers
│           └── health.controller.ts
│
├── application/                     # Layer 2: Application
│   ├── services/                   # Business logic
│   │   ├── auth-application.service.ts
│   │   └── __tests__/
│   └── dtos/                       # Data Transfer Objects
│       ├── sign-in.dto.ts
│       ├── sign-up.dto.ts
│       └── ...
│
├── domain/                          # Layer 3: Domain
│   ├── entities/                   # Domain entities
│   │   ├── user.entity.ts
│   │   └── __tests__/
│   ├── interfaces/                 # Domain interfaces
│   │   ├── auth-provider.interface.ts
│   │   └── user-service.interface.ts
│   └── exceptions/                 # Domain exceptions
│       └── user-inactive.exception.ts
│
├── infrastructure/                  # Layer 4: Infrastructure
│   ├── external/                   # External services
│   │   └── aws/
│   │       └── cognito.adapter.ts
│   └── messaging/                  # Message queues
│       └── grpc/
│           └── user-grpc.client.ts
│
└── shared/                          # Shared utilities
    ├── mappers/                    # Data mappers
    │   ├── user.mapper.ts
    │   └── __tests__/
    ├── helpers/                    # Helper functions
    └── validators/                 # Custom validators
```

### Key Components

#### 1. Presentation Layer

**Purpose**: Handle external requests (GraphQL, gRPC, HTTP)

**Files**:
- `auth.resolver.ts` - GraphQL operations (15 mutations/queries)
- `auth-grpc.controller.ts` - gRPC service methods
- `health.controller.ts` - Health check endpoint

**Responsibilities**:
- Validate input
- Format response
- Handle API-specific errors
- No business logic

#### 2. Application Layer

**Purpose**: Implement business logic and orchestrate operations

**Files**:
- `auth-application.service.ts` - Core business logic (15 methods)

**Key Methods**:
- `signIn()` - Authenticate user
- `signUp()` - Register new user
- `confirmSignUp()` - Verify email
- `forgotPassword()` - Password reset
- `refreshToken()` - Refresh access token
- `changePassword()` - Update password
- `googleAuthentication()` - OAuth login

**Responsibilities**:
- Business workflows
- Validate business rules
- Coordinate infrastructure services
- Transaction management

#### 3. Domain Layer

**Purpose**: Define business rules and contracts

**Files**:
- `user.entity.ts` - User domain entity
- `auth-provider.interface.ts` - Auth provider contract
- `user-service.interface.ts` - User service contract

**Business Rules**:
```typescript
class User {
    canSignIn(): boolean {
        return this.isActive && this.emailVerified
    }
    
    canChangePassword(): boolean {
        return this.isActive
    }
}
```

**Responsibilities**:
- Pure business logic
- No external dependencies
- Domain exceptions
- Value objects

#### 4. Infrastructure Layer

**Purpose**: Implement external integrations

**Files**:
- `cognito.adapter.ts` - AWS Cognito integration
- `user-grpc.client.ts` - User service gRPC client

**Responsibilities**:
- Database operations
- External API calls
- Message queue operations
- File storage

---

## Coding Standards

### 1. File Naming

```
✅ Good:
- auth-application.service.ts
- user.entity.ts
- sign-in.input.ts
- auth.resolver.ts

❌ Bad:
- AuthApplicationService.ts
- userEntity.ts
- SignInInput.ts
```

### 2. Class Naming

```typescript
// ✅ Good
export class AuthApplicationService { }
export class User { }
export class SignInInput { }

// ❌ Bad
export class authApplicationService { }
export class user { }
export class signInInput { }
```

### 3. Method Naming

```typescript
// ✅ Good
async signIn(dto: SignInDto): Promise<SignInResponseDto> { }
async getUserById(id: string): Promise<User | null> { }

// ❌ Bad
async SignIn(dto: SignInDto) { }
async get_user_by_id(id: string) { }
```

### 4. Dependency Injection

```typescript
// ✅ Good - Use interfaces
constructor(
    @Inject("IAuthProvider")
    private readonly authProvider: IAuthProvider,
) {}

// ❌ Bad - Direct dependency
constructor(
    private readonly cognitoService: AwsCognitoService,
) {}
```

### 5. Error Handling

```typescript
// ✅ Good - Domain exceptions
if (!user.isActive) {
    throw new UserInactiveException(user.email)
}

// ❌ Bad - Generic errors
if (!user.isActive) {
    throw new Error("User is inactive")
}
```

### 6. Logging

```typescript
// ✅ Good - Structured logging
this.logger.log(`Sign in attempt for: ${dto.email}`)
this.logger.error(`Sign in failed for ${dto.email}:`, error)

// ❌ Bad - Console.log
console.log("Sign in")
console.log(error)
```

---

## Testing Strategy

### Test Structure

```
src/
├── application/
│   └── services/
│       ├── auth-application.service.ts
│       └── __tests__/
│           └── auth-application.service.spec.ts
├── domain/
│   └── entities/
│       ├── user.entity.ts
│       └── __tests__/
│           └── user.entity.spec.ts
└── shared/
    └── mappers/
        ├── user.mapper.ts
        └── __tests__/
            └── user.mapper.spec.ts
```

### Test Types

#### 1. Unit Tests

**Application Layer**:
```typescript
describe("AuthApplicationService", () => {
    let service: AuthApplicationService
    let mockAuthProvider: jest.Mocked<IAuthProvider>
    let mockUserService: jest.Mocked<IUserService>

    beforeEach(async () => {
        // Mock dependencies
        mockAuthProvider = { signIn: jest.fn(), ... }
        mockUserService = { getUser: jest.fn(), ... }
        
        // Create service with mocks
        service = new AuthApplicationService(
            mockAuthProvider,
            mockUserService,
            new UserMapper(),
        )
    })

    it("should sign in successfully", async () => {
        // Arrange
        mockAuthProvider.signIn.mockResolvedValue({...})
        
        // Act
        const result = await service.signIn({...})
        
        // Assert
        expect(result.accessToken).toBe("token")
    })
})
```

**Domain Layer**:
```typescript
describe("User Entity", () => {
    it("should activate an inactive user", () => {
        const user = new User(..., false, ...)
        
        user.activate()
        
        expect(user.isActive).toBe(true)
    })
})
```

#### 2. Integration Tests (TODO)

- Test with real database (TestContainers)
- Test with real AWS (LocalStack)
- Test gRPC communication

#### 3. E2E Tests (TODO)

- Test GraphQL queries/mutations
- Test full user flows
- Test error scenarios

### Running Tests

```bash
# All tests
npm test

# Specific service
npm test -- apps/auth/src

# With coverage
npm test -- apps/auth/src --coverage

# Watch mode
npm test -- apps/auth/src --watch
```

---

## Deployment

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# AWS Cognito
AWS_COGNITO_USER_POOL_ID=...
AWS_COGNITO_CLIENT_ID=...
AWS_REGION=...

# gRPC
GRPC_AUTH_PORT=50001
GRPC_USER_PORT=50002

# Sentry
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
```

### Build & Deploy

```bash
# Build
npm run build auth

# Start production
npm run start:prod auth

# Docker
docker build -t foodfund-auth -f apps/auth/Dockerfile .
docker run -p 3000:3000 -p 50001:50001 foodfund-auth
```

### Health Checks

```bash
# HTTP
curl http://localhost:3000/health

# GraphQL
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ authHealth { status } }"}'
```

---

## Best Practices

### 1. Always Use Interfaces

```typescript
// ✅ Good
interface IAuthProvider {
    signIn(email: string, password: string): Promise<AuthResult>
}

class CognitoAdapter implements IAuthProvider {
    async signIn(email: string, password: string) {
        return this.awsCognitoService.signIn(email, password)
    }
}
```

### 2. Keep Domain Pure

```typescript
// ✅ Good - Pure domain logic
class User {
    canSignIn(): boolean {
        return this.isActive && this.emailVerified
    }
}

// ❌ Bad - Infrastructure in domain
class User {
    async canSignIn(): Promise<boolean> {
        const dbUser = await this.repository.findById(this.id)
        return dbUser.isActive
    }
}
```

### 3. Use DTOs for Data Transfer

```typescript
// ✅ Good
export class SignInDto {
    email: string
    password: string
}

export class SignInResponseDto {
    accessToken: string
    user: UserDto
}
```

### 4. Validate at Boundaries

```typescript
// ✅ Good - Validate in presentation layer
@InputType()
export class SignInInput {
    @Field()
    @IsEmail()
    email: string

    @Field()
    @MinLength(8)
    password: string
}
```

### 5. Log Everything Important

```typescript
// ✅ Good
this.logger.log(`Sign in attempt for: ${dto.email}`)
this.logger.log(`User signed in successfully: ${user.id}`)
this.logger.error(`Sign in failed for ${dto.email}:`, error)
```

---

## Quick Reference

### Adding a New Feature

1. **Define Domain Interface** (if needed)
   ```typescript
   // domain/interfaces/new-feature.interface.ts
   export interface INewFeature {
       doSomething(): Promise<Result>
   }
   ```

2. **Create Infrastructure Implementation**
   ```typescript
   // infrastructure/external/new-feature.adapter.ts
   export class NewFeatureAdapter implements INewFeature {
       async doSomething() { ... }
   }
   ```

3. **Add Application Service Method**
   ```typescript
   // application/services/auth-application.service.ts
   async newFeature(dto: NewFeatureDto) {
       const result = await this.newFeature.doSomething()
       return result
   }
   ```

4. **Create Presentation Layer**
   ```typescript
   // presentation/graphql/resolvers/auth.resolver.ts
   @Mutation(() => NewFeatureResponse)
   async newFeature(@Args("input") input: NewFeatureInput) {
       return this.authApplicationService.newFeature(input)
   }
   ```

5. **Register in AppModule**
   ```typescript
   // app.module.ts
   providers: [
       {
           provide: "INewFeature",
           useClass: NewFeatureAdapter,
       },
   ]
   ```

6. **Write Tests**
   ```typescript
   // application/services/__tests__/auth-application.service.spec.ts
   it("should handle new feature", async () => {
       // Test implementation
   })
   ```

---

## Resources

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [NestJS Documentation](https://docs.nestjs.com/)
- [GraphQL Federation](https://www.apollographql.com/docs/federation/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)

---

## Support

For questions or issues:
1. Check documentation in `/apps/auth/` folder
2. Review test examples
3. Ask team members
4. Create GitHub issue

---

**Last Updated**: 2025-11-02  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
