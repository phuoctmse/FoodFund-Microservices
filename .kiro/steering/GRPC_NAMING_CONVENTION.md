# gRPC Naming Convention Guide

## TL;DR - Quick Reference

| Layer | Convention | Example |
|-------|-----------|---------|
| **Proto files** | snake_case | `cognito_id`, `full_name`, `access_token` |
| **JavaScript/TypeScript** | camelCase | `cognitoId`, `fullName`, `accessToken` |
| **Database (Prisma)** | snake_case | `cognito_id`, `full_name`, `is_active` |

**Proto Loader Config:** `keepCase: false` (auto-converts snake_case → camelCase)

## Complete Field Mapping

### Auth Service Fields

| Proto (snake_case) | JavaScript (camelCase) | Notes |
|-------------------|------------------------|-------|
| `access_token` | `accessToken` | Request field |
| `refresh_token` | `refreshToken` | Request field |
| `cognito_id` | `cognitoId` | User field |
| `expires_at` | `expiresAt` | Response field |
| `expires_in` | `expiresIn` | Response field |
| `user_id` | `userId` | Request field |

### User Service Fields

| Proto (snake_case) | JavaScript (camelCase) | Notes |
|-------------------|------------------------|-------|
| `cognito_id` | `cognitoId` | Primary identifier |
| `full_name` | `fullName` | User name |
| `phone_number` | `phoneNumber` | Contact |
| `avatar_url` | `avatarUrl` | Profile image |
| `is_active` | `isActive` | Status flag |
| `created_at` | `createdAt` | Timestamp |
| `updated_at` | `updatedAt` | Timestamp |
| `user_name` | `username` | Special case* |
| `cognito_attributes` | `cognitoAttributes` | Nested object |

*Note: `user_name` → `username` (not `userName`) for consistency with Cognito

## Rules

### 1. Proto Files (`.proto`)
✅ **Always use snake_case**
```protobuf
message User {
  string cognito_id = 1;
  string full_name = 2;
  bool is_active = 3;
}
```

### 2. JavaScript/TypeScript Code
✅ **Always use camelCase**

**Sending Requests:**
```typescript
// ✅ Correct
await grpcClient.callUserService("GetUser", {
    cognitoId: id
})

// ❌ Wrong
await grpcClient.callUserService("GetUser", {
    cognito_id: id  // Won't work!
})
```

**Receiving Responses:**
```typescript
// ✅ Correct
if (response.user.isActive) {
    console.log(response.user.fullName)
}

// ❌ Wrong
if (response.user.is_active) {  // undefined!
    console.log(response.user.full_name)  // undefined!
}
```

**Mapping Responses:**
```typescript
// ✅ Correct - Return camelCase
callback(null, {
    success: true,
    user: {
        cognitoId: dbUser.cognito_id,
        fullName: dbUser.full_name,
        isActive: dbUser.is_active,
    }
})

// ❌ Wrong - Don't return snake_case
callback(null, {
    success: true,
    user: {
        cognito_id: dbUser.cognito_id,  // Won't be recognized!
        full_name: dbUser.full_name,
    }
})
```

### 3. Database Layer (Prisma)
✅ **Use snake_case (matches schema)**
```typescript
// Reading from DB
const user = await prisma.user.findUnique({
    where: { cognito_id: id }
})

// Accessing fields
console.log(user.full_name)
console.log(user.is_active)
```

## Common Patterns

### Pattern 1: Request Handler (Receiving)
```typescript
async getUser(call: any, callback: any) {
    // ✅ Destructure with camelCase
    const { cognitoId } = call.request
    
    // ❌ Don't use snake_case
    // const { cognito_id } = call.request  // undefined!
    
    // Use camelCase variable with snake_case DB
    const user = await repo.findUserByCognitoId(cognitoId)
}
```

### Pattern 2: Response Mapping (Sending)
```typescript
// Database returns snake_case
const dbUser = {
    cognito_id: "123",
    full_name: "John Doe",
    is_active: true,
    created_at: new Date()
}

// ✅ Map to camelCase for gRPC
callback(null, {
    user: {
        cognitoId: dbUser.cognito_id,
        fullName: dbUser.full_name,
        isActive: dbUser.is_active,
        createdAt: dbUser.created_at.toISOString()
    }
})
```

### Pattern 3: Client Call (Sending)
```typescript
// ✅ Send camelCase
const response = await grpcClient.callUserService("CreateUser", {
    cognitoId: user.sub,
    email: user.email,
    fullName: user.name,
    cognitoAttributes: {
        avatarUrl: user.picture,
        bio: user.bio
    }
})

// ✅ Receive camelCase
console.log(response.user.cognitoId)
console.log(response.user.fullName)
```

## Checklist for New gRPC Methods

When adding a new gRPC method:

- [ ] Define message in proto with **snake_case**
- [ ] TypeScript interface uses **camelCase**
- [ ] Request handler destructures with **camelCase**
- [ ] Database queries use **snake_case**
- [ ] Response mapping returns **camelCase**
- [ ] Client calls send **camelCase**
- [ ] Client reads response with **camelCase**

## Testing Your Changes

### 1. Check Proto Loader Config
```bash
grep "keepCase" libs/grpc/grpc-client.service.ts
# Should show: keepCase: false
```

### 2. Search for Snake Case in gRPC Code
```bash
# Should return NO results in gRPC TypeScript files
grep -r "cognito_id\|full_name\|is_active" apps/*/src/**/*grpc*.ts

# Exception: OK in comments or when reading from DB
# user.cognito_id (reading from DB) ✅
# cognitoId: user.cognito_id (mapping) ✅
# cognito_id: user.cognito_id (response) ❌
```

### 3. Test gRPC Calls
```typescript
// Add debug logging
console.log("Request:", JSON.stringify(request))
console.log("Response:", JSON.stringify(response))

// Verify fields are populated
if (!response.user.cognitoId) {
    console.error("❌ cognitoId is missing - check mapping!")
}
```

## Common Mistakes & Fixes

### Mistake 1: Using snake_case in Request
```typescript
// ❌ Wrong
const response = await grpcClient.callUserService("GetUser", {
    cognito_id: id  // Field not recognized
})

// ✅ Fix
const response = await grpcClient.callUserService("GetUser", {
    cognitoId: id
})
```

### Mistake 2: Using snake_case in Response
```typescript
// ❌ Wrong
callback(null, {
    user: {
        cognito_id: user.cognito_id  // Field not recognized
    }
})

// ✅ Fix
callback(null, {
    user: {
        cognitoId: user.cognito_id
    }
})
```

### Mistake 3: Reading snake_case from Response
```typescript
// ❌ Wrong
if (response.user.is_active) {  // undefined
    // ...
}

// ✅ Fix
if (response.user.isActive) {
    // ...
}
```

### Mistake 4: Mixing Conventions
```typescript
// ❌ Wrong - Inconsistent
{
    cognitoId: id,
    full_name: name,  // Mixed!
    isActive: true
}

// ✅ Fix - All camelCase
{
    cognitoId: id,
    fullName: name,
    isActive: true
}
```

## Why This Convention?

1. **Proto Standard**: Protobuf convention is snake_case
2. **JavaScript Standard**: JavaScript/TypeScript convention is camelCase
3. **Database Standard**: SQL/Prisma convention is snake_case
4. **Auto-conversion**: Proto loader handles conversion automatically
5. **Type Safety**: TypeScript interfaces enforce correct naming

## Files to Check

### Proto Files (snake_case)
- `libs/grpc/proto/auth.proto`
- `libs/grpc/proto/user.proto`
- `libs/grpc/proto/campaign.proto`

### gRPC Implementations (camelCase)
- `apps/auth/src/infrastructure/grpc/*.ts`
- `apps/user/src/infrastructure/grpc/*.ts`
- `apps/campaign/src/infrastructure/grpc/*.ts`

### gRPC Clients (camelCase)
- `libs/grpc/grpc-client.service.ts`
- `libs/auth/guards/role.guard.ts`
- Any service calling gRPC

## Quick Fix Script

If you find snake_case in gRPC TypeScript files:

```bash
# Find all occurrences
grep -rn "cognito_id\|full_name\|is_active" apps/*/src/**/*grpc*.ts

# Common replacements:
# cognito_id → cognitoId
# full_name → fullName
# phone_number → phoneNumber
# avatar_url → avatarUrl
# is_active → isActive
# created_at → createdAt
# updated_at → updatedAt
# access_token → accessToken
# refresh_token → refreshToken
# expires_at → expiresAt
# expires_in → expiresIn
# user_id → userId
```

## Summary

✅ **Proto**: snake_case (standard)  
✅ **JavaScript**: camelCase (standard)  
✅ **Database**: snake_case (standard)  
✅ **Conversion**: Automatic with `keepCase: false`

**Golden Rule**: When working with gRPC in TypeScript, **always use camelCase**. The proto loader will handle the conversion to/from proto's snake_case automatically.
