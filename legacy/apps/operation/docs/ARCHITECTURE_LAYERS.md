# Kiến Trúc Phân Tầng (Layered Architecture)

## 📐 Tổng Quan

Dự án sử dụng **Clean Architecture** với 5 tầng chính:

```
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │  ← API Endpoints (HTTP, GraphQL, gRPC)
├─────────────────────────────────────────┤
│         APPLICATION LAYER               │  ← Business Logic & Use Cases
├─────────────────────────────────────────┤
│         DOMAIN LAYER                    │  ← Core Business Rules & Entities
├─────────────────────────────────────────┤
│         INFRASTRUCTURE LAYER            │  ← External Services & Database
├─────────────────────────────────────────┤
│         SHARED LAYER                    │  ← Common Utilities & Helpers
└─────────────────────────────────────────┘
```

## 🎯 Dependency Rule

```
Presentation → Application → Domain
                    ↓
            Infrastructure
                    ↓
                 Shared
```

**Nguyên tắc**: Các tầng bên trong **KHÔNG** phụ thuộc vào tầng bên ngoài.

---

## 1️⃣ PRESENTATION LAYER

### 📍 Vị trí
```
apps/{service}/src/presentation/
├── graphql/          # GraphQL Resolvers
│   ├── resolvers/
│   └── schemas/
└── http/             # REST API Controllers
    └── controllers/
```

### 🎯 Trách nhiệm
- **Nhận requests** từ clients (HTTP, GraphQL, gRPC)
- **Validate input** từ users
- **Gọi Application Layer** để xử lý business logic
- **Format response** trả về cho clients
- **Handle errors** và convert thành HTTP status codes

### 📝 Ví dụ

#### GraphQL Resolver (User Service)
```typescript
// apps/user/src/presentation/graphql/resolvers/user-query.resolver.ts
@Resolver()
export class UserQueryResolver {
    constructor(
        private readonly userQueryService: UserQueryService, // ← Application Layer
    ) {}

    @Query(() => UserProfileSchema)
    async getUser(@Args('id') id: string) {
        // 1. Validate input (GraphQL handles this)
        // 2. Call Application Layer
        const user = await this.userQueryService.findUserById(id)
        // 3. Return formatted response
        return user
    }
}
```

#### HTTP Controller (Auth Service)
```typescript
// apps/auth/src/presentation/http/controllers/health.controller.ts
@Controller('health')
export class HealthController {
    @Get()
    check() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        }
    }
}
```

### ✅ Best Practices
- ✅ Chỉ handle HTTP/GraphQL concerns
- ✅ Không chứa business logic
- ✅ Thin controllers/resolvers
- ✅ Delegate to Application Layer
- ❌ Không truy cập Database trực tiếp
- ❌ Không chứa business rules

---

## 2️⃣ APPLICATION LAYER

### 📍 Vị trí
```
apps/{service}/src/application/
├── dtos/             # Data Transfer Objects
│   ├── user.input.ts
│   └── profile.input.ts
└── services/         # Use Cases / Business Logic
    ├── admin/
    ├── common/
    └── organization/
```

### 🎯 Trách nhiệm
- **Orchestrate business logic** (use cases)
- **Coordinate** giữa Domain và Infrastructure
- **Transaction management**
- **Business workflows**
- **Data transformation** (Entity ↔ DTO)

### 📝 Ví dụ

#### Use Case Service
```typescript
// apps/user/src/application/services/organization/organization.service.ts
@Injectable()
export class OrganizationService {
    constructor(
        private readonly organizationRepository: OrganizationRepository, // ← Domain
        private readonly userRepository: UserRepository,                 // ← Domain
        private readonly awsCognitoService: AwsCognitoService,          // ← Infrastructure
        private readonly prisma: PrismaClient,                          // ← Infrastructure
    ) {}

    async approveOrganizationRequest(organizationId: string) {
        // 1. Validate business rules
        const organization = await this.organizationRepository.findOrganizationById(organizationId)
        if (!organization) {
            throw new NotFoundException('Organization not found')
        }

        // 2. Execute business workflow with transaction
        return await this.prisma.$transaction(async (tx) => {
            // Update organization status
            await tx.organization.update({
                where: { id: organizationId },
                data: { status: VerificationStatus.VERIFIED },
            })

            // Update user role
            await tx.user.update({
                where: { id: organization.representative_id },
                data: { role: Role.FUNDRAISER },
            })

            // Create organization member
            await tx.organization_Member.create({
                data: {
                    organization_id: organizationId,
                    member_id: organization.representative_id,
                    member_role: Role.FUNDRAISER,
                    status: VerificationStatus.VERIFIED,
                },
            })
        })

        // 3. Sync with external service
        await this.awsCognitoService.updateUserAttributes(
            organization.user.cognito_id,
            { 'custom:role': Role.FUNDRAISER }
        )
    }
}
```

#### DTO (Data Transfer Object)
```typescript
// apps/user/src/application/dtos/user.input.ts
@InputType()
export class CreateOrganizationInput {
    @Field()
    @IsNotEmpty()
    name: string

    @Field()
    @IsNotEmpty()
    description: string

    @Field()
    @IsPhoneNumber('VN')
    phone_number: string
}
```

### ✅ Best Practices
- ✅ Chứa business logic chính
- ✅ Orchestrate workflows
- ✅ Use transactions khi cần
- ✅ Validate business rules
- ✅ Transform data (DTO ↔ Entity)
- ❌ Không handle HTTP/GraphQL concerns
- ❌ Không chứa database queries trực tiếp

---

## 3️⃣ DOMAIN LAYER

### 📍 Vị trí
```
apps/{service}/src/domain/
├── entities/         # Domain Models
│   ├── user.model.ts
│   └── auth-response.model.ts
├── enums/           # Business Enums
│   └── role.enum.ts
├── exceptions/      # Domain Exceptions
│   ├── user.exceptions.ts
│   └── donor.exceptions.ts
└── repositories/    # Repository Interfaces
    ├── user.repository.ts
    └── organization.repository.ts
```

### 🎯 Trách nhiệm
- **Core business rules** (không thay đổi theo technology)
- **Domain models** (entities)
- **Business exceptions**
- **Repository interfaces** (contracts)
- **Domain logic** (pure business rules)

### 📝 Ví dụ

#### Domain Entity
```typescript
// apps/auth/src/domain/entities/auth-user.model.ts
@ObjectType()
export class AuthUser {
    @Field()
    id: string

    @Field()
    email: string

    @Field()
    username: string

    @Field()
    name: string

    @Field()
    emailVerified: boolean

    @Field()
    provider: string

    @Field()
    createdAt: Date

    @Field()
    updatedAt: Date
}
```

#### Domain Exception
```typescript
// apps/user/src/domain/exceptions/user.exceptions.ts
export class UserErrorHelper {
    static throwUserNotFound(identifier: string): never {
        throw new NotFoundException(
            `User not found with identifier: ${identifier}`
        )
    }

    static throwUnauthorizedRole(
        currentRole: Role,
        allowedRoles: Role[]
    ): never {
        throw new ForbiddenException(
            `Role ${currentRole} is not authorized. Allowed roles: ${allowedRoles.join(', ')}`
        )
    }
}
```

#### Repository Interface
```typescript
// apps/user/src/domain/repositories/user.repository.ts
@Injectable()
export abstract class UserRepository {
    abstract findUserById(id: string): Promise<User | null>
    abstract findUserByEmail(email: string): Promise<User | null>
    abstract findUserByCognitoId(cognitoId: string): Promise<User | null>
    abstract updateUser(id: string, data: any): Promise<User>
    abstract deleteUser(id: string): Promise<User>
}
```

### ✅ Best Practices
- ✅ Pure business logic
- ✅ Technology-agnostic
- ✅ Define interfaces (contracts)
- ✅ Domain exceptions
- ✅ Business rules validation
- ❌ Không phụ thuộc vào frameworks
- ❌ Không chứa infrastructure code
- ❌ Không import từ Presentation/Application

---

## 4️⃣ INFRASTRUCTURE LAYER

### 📍 Vị trí
```
apps/{service}/src/infrastructure/
├── database/         # Database Implementation
│   ├── prisma-user.service.ts
│   └── repositories/
├── grpc/            # gRPC Controllers
│   └── user-grpc.controller.ts
├── messaging/       # Message Queues
└── externals/       # External Services
    └── aws-cognito/
```

### 🎯 Trách nhiệm
- **Implement Repository interfaces** từ Domain
- **Database access** (Prisma, TypeORM)
- **External API calls** (AWS, third-party)
- **Message queues** (SQS, RabbitMQ)
- **File storage** (S3)
- **Cache** (Redis)

### 📝 Ví dụ

#### Repository Implementation
```typescript
// apps/user/src/infrastructure/database/repositories/user.repository.impl.ts
@Injectable()
export class UserRepositoryImpl extends UserRepository {
    constructor(private readonly prisma: PrismaUserService) {
        super()
    }

    async findUserById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
        })
    }

    async findUserByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
        })
    }

    async updateUser(id: string, data: any): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data,
        })
    }
}
```

#### gRPC Controller
```typescript
// apps/user/src/infrastructure/grpc/user-grpc.controller.ts
@Controller()
export class UserGrpcController {
    constructor(
        private readonly userCommonRepository: UserCommonRepository,
        private readonly userAdminRepository: UserAdminRepository,
    ) {}

    @GrpcMethod("UserService", "GetUser")
    async getUser(data: GetUserRequest): Promise<GetUserResponse> {
        try {
            const { cognitoId } = data

            if (!cognitoId) {
                return {
                    success: false,
                    user: null,
                    error: "Cognito ID is required",
                }
            }

            const user = await this.userCommonRepository.findUserByCognitoId(cognitoId)

            if (!user) {
                return {
                    success: false,
                    user: null,
                    error: "User not found",
                }
            }

            return {
                success: true,
                user: {
                    id: user.id,
                    cognitoId: user.cognito_id,
                    email: user.email,
                    // ... map fields
                },
                error: null,
            }
        } catch (error) {
            return {
                success: false,
                user: null,
                error: error.message,
            }
        }
    }
}
```

#### External Service
```typescript
// libs/aws-cognito/aws-cognito.service.ts
@Injectable()
export class AwsCognitoService {
    private cognitoClient: CognitoIdentityProviderClient

    constructor() {
        this.cognitoClient = new CognitoIdentityProviderClient({
            region: envConfig().aws.region,
        })
    }

    async signIn(email: string, password: string) {
        const command = new InitiateAuthCommand({
            AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
            ClientId: envConfig().aws.cognito.clientId,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password,
            },
        })

        const response = await this.cognitoClient.send(command)
        return response.AuthenticationResult
    }
}
```

### ✅ Best Practices
- ✅ Implement Domain interfaces
- ✅ Handle external dependencies
- ✅ Database transactions
- ✅ Error handling & retry logic
- ✅ Logging & monitoring
- ❌ Không chứa business logic
- ❌ Chỉ technical concerns

---

## 5️⃣ SHARED LAYER

### 📍 Vị trí
```
apps/{service}/src/shared/
├── helpers/          # Utility Functions
│   ├── auth-error.helper.ts
│   └── base.schema.ts
├── types/           # Shared Types
│   ├── user.types.ts
│   └── organization-response.model.ts
└── validators/      # Custom Validators
```

### 🎯 Trách nhiệm
- **Common utilities** dùng chung
- **Helper functions**
- **Shared types/interfaces**
- **Custom validators**
- **Constants**

### 📝 Ví dụ

#### Error Helper
```typescript
// apps/auth/src/shared/helpers/auth-error.helper.ts
export class AuthErrorHelper {
    static mapCognitoError(
        error: any,
        operation: string,
        email?: string
    ): never {
        if (error.name === 'NotAuthorizedException') {
            throw new UnauthorizedException('Invalid credentials')
        }

        if (error.name === 'UserNotFoundException') {
            throw new NotFoundException(`User not found: ${email}`)
        }

        if (error.name === 'UsernameExistsException') {
            throw new ConflictException(`Email already exists: ${email}`)
        }

        throw new InternalServerErrorException(
            `${operation} failed: ${error.message}`
        )
    }
}
```

#### Base Schema
```typescript
// apps/user/src/shared/helpers/base.schema.ts
@ObjectType()
export abstract class BaseSchema {
    @Field()
    id: string

    @Field()
    created_at: Date

    @Field()
    updated_at: Date
}
```

#### Shared Types
```typescript
// apps/user/src/shared/types/user.types.ts
export interface UserWithOrganization {
    id: string
    email: string
    full_name: string
    organization?: {
        id: string
        name: string
        status: string
    }
}
```

### ✅ Best Practices
- ✅ Pure utility functions
- ✅ No business logic
- ✅ Reusable across layers
- ✅ Stateless helpers
- ❌ Không phụ thuộc vào layers khác
- ❌ Không chứa business rules

---

## 🔄 Data Flow Example

### Ví dụ: User Login Flow

```
1. CLIENT REQUEST
   ↓
2. PRESENTATION (HTTP Controller)
   POST /auth/login
   ↓
3. APPLICATION (AuthService)
   - Validate credentials
   - Check user status
   ↓
4. INFRASTRUCTURE (AwsCognitoService)
   - Call AWS Cognito API
   ↓
5. INFRASTRUCTURE (UserRepository)
   - Query database
   ↓
6. DOMAIN (User Entity)
   - Business rules validation
   ↓
7. APPLICATION (AuthService)
   - Generate tokens
   - Transform to DTO
   ↓
8. PRESENTATION (HTTP Controller)
   - Format response
   ↓
9. CLIENT RESPONSE
   { accessToken, refreshToken, user }
```

### Code Flow

```typescript
// 1. PRESENTATION
@Controller('auth')
export class AuthController {
    @Post('login')
    async login(@Body() input: SignInInput) {
        return this.authService.signIn(input) // → APPLICATION
    }
}

// 2. APPLICATION
@Injectable()
export class AuthAuthenticationService {
    async signIn(input: SignInInput) {
        // Call Infrastructure
        const result = await this.awsCognitoService.signIn(
            input.email,
            input.password
        )

        // Get user from Repository
        const user = await this.userRepository.findUserByEmail(input.email)

        // Validate Domain rules
        if (!user.isActive) {
            throw new UnauthorizedException('Account deactivated')
        }

        // Return DTO
        return {
            user: this.mapToDTO(user),
            accessToken: result.AccessToken,
            refreshToken: result.RefreshToken,
        }
    }
}

// 3. INFRASTRUCTURE
@Injectable()
export class AwsCognitoService {
    async signIn(email: string, password: string) {
        const command = new InitiateAuthCommand({
            AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
            ClientId: this.clientId,
            AuthParameters: { USERNAME: email, PASSWORD: password },
        })
        return await this.cognitoClient.send(command)
    }
}

// 4. DOMAIN
export class User {
    id: string
    email: string
    isActive: boolean

    // Domain method
    canLogin(): boolean {
        return this.isActive && this.emailVerified
    }
}
```

---

## 📊 Layer Dependencies Matrix

| Layer          | Can Import From                    | Cannot Import From        |
|----------------|-----------------------------------|---------------------------|
| Presentation   | Application, Domain, Shared       | Infrastructure            |
| Application    | Domain, Infrastructure, Shared    | Presentation              |
| Domain         | Shared only                       | All other layers          |
| Infrastructure | Domain, Shared                    | Application, Presentation |
| Shared         | Nothing (standalone)              | All layers                |

---

## 🎯 Benefits of This Architecture

### 1. **Separation of Concerns**
- Mỗi layer có trách nhiệm rõ ràng
- Dễ maintain và test

### 2. **Testability**
- Mock dependencies dễ dàng
- Unit test từng layer độc lập

### 3. **Flexibility**
- Thay đổi database không ảnh hưởng business logic
- Thay đổi API không ảnh hưởng domain

### 4. **Scalability**
- Dễ thêm features mới
- Dễ refactor

### 5. **Team Collaboration**
- Nhiều dev làm việc parallel
- Clear boundaries

---

## 🚀 Quick Reference

### Khi nào dùng layer nào?

| Tôi muốn...                          | Dùng Layer          |
|--------------------------------------|---------------------|
| Tạo REST API endpoint                | Presentation        |
| Tạo GraphQL resolver                 | Presentation        |
| Implement business logic             | Application         |
| Orchestrate workflow                 | Application         |
| Define business rules                | Domain              |
| Create domain model                  | Domain              |
| Query database                       | Infrastructure      |
| Call external API                    | Infrastructure      |
| Create utility function              | Shared              |
| Define custom validator              | Shared              |

---

**Last Updated**: November 5, 2025
**Architecture Pattern**: Clean Architecture / Layered Architecture
**Services**: Auth, User, Campaign, Operation
