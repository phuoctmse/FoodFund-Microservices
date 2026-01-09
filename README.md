<h1 align="center">🍲 FoodFund Microservices</h1>

<p align="center">
  <strong>A modern microservices-based donation platform for food campaigns</strong>
</p>

<p align="center">
  <a href="https://nestjs.com/" target="_blank"><img src="https://img.shields.io/badge/NestJS-v11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" /></a>
  <a href="https://www.typescriptlang.org/" target="_blank"><img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://graphql.org/" target="_blank"><img src="https://img.shields.io/badge/GraphQL-Federation-E10098?style=for-the-badge&logo=graphql&logoColor=white" alt="GraphQL" /></a>
  <a href="https://www.prisma.io/" target="_blank"><img src="https://img.shields.io/badge/Prisma-6.19-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" /></a>
</p>

<p align="center">
  <a href="https://www.postgresql.org/" target="_blank"><img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://redis.io/" target="_blank"><img src="https://img.shields.io/badge/Redis-Cache-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis" /></a>
  <a href="https://kafka.apache.org/" target="_blank"><img src="https://img.shields.io/badge/Kafka-Messaging-231F20?style=flat-square&logo=apachekafka&logoColor=white" alt="Kafka" /></a>
  <a href="https://opensearch.org/" target="_blank"><img src="https://img.shields.io/badge/OpenSearch-Search-005EB8?style=flat-square&logo=opensearch&logoColor=white" alt="OpenSearch" /></a>
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Microservices](#-microservices)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Development](#-development)
- [Deployment](#-deployment)
- [Environment Variables](#-environment-variables)
- [Contributing](#-contributing)

---

## 🎯 Overview

**FoodFund** is a comprehensive donation platform designed to connect donors with food-related charitable campaigns. Built with a microservices architecture, this platform provides:

- 🔐 **Secure Authentication** - AWS Cognito integration for robust user authentication
- 📊 **Campaign Management** - Create, manage, and track donation campaigns
- 💳 **Payment Processing** - Integrated with PayOS and SePay for secure transactions
- 🔍 **Advanced Search** - AWS OpenSearch for fast and efficient search capabilities
- 📧 **Email Notifications** - Brevo integration for transactional emails
- 📱 **Real-time Updates** - Event-driven architecture using Kafka and BullMQ

---

## 🏗 System Architecture

<p align="center">
  <img src="./images/System Architecture Diagram.jpg" alt="System Architecture" width="100%"/>
</p>

The system follows a **microservices architecture** with the following key components:

| Layer | Components |
|-------|------------|
| **Client Layer** | Web Application, Mobile Application |
| **API Gateway** | Apollo GraphQL Federation Gateway |
| **Services** | Auth, User, Campaign, Operation |
| **Data Layer** | PostgreSQL (per service), Redis Cache |
| **Event Streaming** | Apache Kafka, Debezium CDC |
| **Search Engine** | AWS OpenSearch |
| **Observability** | Datadog, Sentry |

### Key Architectural Patterns

- **GraphQL Federation**: Unified API gateway composing multiple subgraphs
- **Database per Service**: Each microservice owns its PostgreSQL database
- **Event-Driven Architecture**: Kafka for async communication between services
- **Change Data Capture (CDC)**: Debezium for real-time data synchronization to OpenSearch
- **Circuit Breaker**: Resilient inter-service communication with fault tolerance

---

## 🛠 Tech Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | v11.1.6 | Backend framework |
| TypeScript | v5.9 | Programming language |
| GraphQL | v16.11 | API layer |
| Apollo Federation | v2.11 | Gateway & subgraphs |

### Data & Storage
| Technology | Purpose |
|------------|---------|
| PostgreSQL | Primary database (per service) |
| Prisma | ORM for database operations |
| Redis | Caching & session management |
| AWS OpenSearch | Full-text search engine |

### Messaging & Events
| Technology | Purpose |
|------------|---------|
| Apache Kafka | Event streaming platform |
| Debezium | Change Data Capture |
| BullMQ | Job queue management |

### AWS Services
| Service | Purpose |
|---------|---------|
| AWS Cognito | User authentication & authorization |
| AWS S3 | File storage |
| AWS SQS | Message queuing |
| AWS OpenSearch | Search service |

### Third-Party Integrations
| Service | Purpose |
|---------|---------|
| PayOS | Payment gateway |
| SePay | Alternative payment gateway |
| Brevo | Email service |
| OneSignal | Push notifications |

### Observability
| Technology | Purpose |
|------------|---------|
| Datadog | APM, logging, and tracing |
| Sentry | Error tracking |

---

## 📦 Microservices

### 1. GraphQL Gateway (`apps/graphql-gateway`)
The API gateway that composes all GraphQL subgraphs using Apollo Federation.

- Unified GraphQL endpoint
- Request routing and composition
- Circuit breaker pattern for resilience
- Authentication middleware

### 2. Auth Service (`apps/auth`)
Handles authentication and authorization using AWS Cognito.

- User sign-up, sign-in, and verification
- Token refresh and validation
- Role-based access control
- gRPC communication with other services

### 3. User Service (`apps/user`)
Manages user profiles, organizations, and related data.

- User profile management
- Organization management
- Fundraiser and donor profiles
- Wallet management

### 4. Campaign Service (`apps/campaign`)
Core service for managing donation campaigns.

- Campaign CRUD operations
- Donation processing
- Campaign statistics
- Payment integration (PayOS, SePay)
- Notification management

### 5. Operation Service (`apps/operation`)
Handles operational tasks and logistics.

- Operation request management
- Resource allocation
- Delivery tracking
- Kitchen operations

---

## 📁 Project Structure

```
FoodFund-Microservices/
├── apps/                          # Microservices
│   ├── auth/                      # Authentication service
│   ├── campaign/                  # Campaign management service
│   ├── graphql-gateway/           # Apollo Federation gateway
│   ├── operation/                 # Operations service
│   └── user/                      # User management service
│
├── libs/                          # Shared libraries
│   ├── auth/                      # Authentication utilities
│   ├── aws-cognito/               # AWS Cognito integration
│   ├── aws-opensearch/            # OpenSearch client
│   ├── aws-sqs/                   # SQS utilities
│   ├── common/                    # Common utilities
│   ├── databases/                 # Database configurations
│   ├── email/                     # Brevo email service
│   ├── graphql/                   # GraphQL utilities
│   ├── grpc/                      # gRPC configurations
│   ├── jwt/                       # JWT utilities
│   ├── observability/             # Datadog/Sentry integration
│   ├── payos/                     # PayOS integration
│   ├── queue/                     # BullMQ configurations
│   ├── redis/                     # Redis client
│   ├── s3-storage/                # S3 file storage
│   ├── sepay/                     # SePay integration
│   ├── validation/                # Input validation
│   └── vietqr/                    # VietQR integration
│
├── infrastructure/                # Debezium connectors
├── k8s/                          # Kubernetes manifests
├── database/                     # Database migrations
├── scripts/                      # Deployment scripts
└── seed_data/                    # Seed data files
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20.x
- **npm** >= 10.x
- **Docker** & **Docker Compose**
- **PostgreSQL** 15+
- **Redis** 7+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/phuoctmse/FoodFund-Microservices.git
   cd FoodFund-Microservices
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start infrastructure services**
   ```bash
   docker-compose up -d
   ```

5. **Generate Prisma clients**
   ```bash
   npm run prisma:generate:user
   npm run prisma:generate:campaign
   npm run prisma:generate:operation
   ```

6. **Run database migrations**
   ```bash
   npm run prisma:migrate:user
   npm run prisma:migrate:campaign
   npm run prisma:migrate:operation
   ```

---

## 💻 Development

### Running Services

```bash
# Start all services in development mode
npm run start:gateway    # GraphQL Gateway (port 3000)
npm run start:auth       # Auth Service (port 3001)
npm run start:user       # User Service (port 3002)
npm run start:campaign   # Campaign Service (port 3003)
npm run start:operation  # Operation Service (port 3004)
```

### Building Services

```bash
# Build individual services
npm run build:gateway
npm run build:auth
npm run build:user
npm run build:campaign
npm run build:operation
```

### Database Management

```bash
# Prisma Studio (GUI for database)
npm run prisma:studio:user
npm run prisma:studio:campaign
npm run prisma:studio:operation

# Create new migration
npm run prisma:migrate:user
npm run prisma:migrate:campaign
npm run prisma:migrate:operation
```

### Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### Code Quality

```bash
# Lint
npm run lint

# Format
npm run format
```

---

## 🚢 Deployment

### Kubernetes Deployment

The project includes Kubernetes manifests in the `k8s/` directory for deployment to clusters like DigitalOcean Kubernetes (DOKS).

```bash
# Apply Kubernetes configurations
kubectl apply -f k8s/
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up --build
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure the following:

| Category | Variables |
|----------|-----------|
| **Database** | `DATABASE_URL`, `REDIS_URL` |
| **AWS** | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| **Cognito** | `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` |
| **Kafka** | `KAFKA_BROKERS`, `KAFKA_GROUP_ID` |
| **PayOS** | `PAYOS_CLIENT_ID`, `PAYOS_API_KEY` |
| **Brevo** | `BREVO_API_KEY` |
| **Observability** | `DD_API_KEY`, `SENTRY_DSN` |

See [.env.example](./.env.example) for complete configuration.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is **UNLICENSED** - private and proprietary.

---

<p align="center">
  Made with ❤️ by the FoodFund Team
</p>
