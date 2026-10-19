# FoodFund Microservices — Agent Guide

NestJS 11 monorepo (TypeScript), GraphQL Federation (Apollo Gateway) + gRPC giữa các service,
Prisma 6 / PostgreSQL (mỗi service một DB), Redis/Bull, Kafka, AWS (Cognito, S3, SQS, OpenSearch).
Deploy: Docker → Helm (`k8s/charts`) → ArgoCD. Dự án ĐANG CHẠY PRODUCTION — ưu tiên an toàn hơn tốc độ.

## Package manager: **npm** (duy nhất)

- Lockfile: `package-lock.json` (npm workspaces: `apps/*`, `libs/*`). CI dùng `npm ci`.
- KHÔNG dùng `yarn`, `pnpm`, `bun`, `bunx` (đã bị chặn ở `.claude/settings.json`).
- `npx` chỉ dùng cho binary đã có trong `node_modules` (prisma, jest, eslint, nest). Không `npx <pkg>@latest`.

## Lệnh chuẩn (lấy từ `package.json` / CI)

| Mục đích | Lệnh |
|---|---|
| Cài deps | `npm ci` (chỉ dùng `npm install <pkg>` khi được yêu cầu thêm dependency) |
| Dev 1 service | `npm run start:gateway` · `start:auth` · `start:user` · `start:campaign` · `start:operation` |
| Build 1 service | `npm run build:gateway` · `build:auth` · `build:user` · `build:campaign` · `build:operation` |
| Lint (check, như CI) | `npm run lint:check` |
| Lint 1 file | `npx eslint path/to/file.ts` |
| Format | `npm run format` / `npm run format:check` (chỉ chạy khi được yêu cầu — nó sửa toàn repo) |
| Test toàn bộ | `npm test` |
| **Test 1 file** | `npx jest --config jest.config.js path/to/file.spec.ts` |
| Test liên quan file vừa sửa | `npx jest --config jest.config.js --findRelatedTests <files...> --passWithNoTests` |
| Test e2e | `npm run test:e2e` (file `*.e2e-spec.ts`, cần DB/infra thật) |
| Prisma client | `npm run prisma:generate:user` · `prisma:generate:campaign` · `prisma:generate:operation` |

Lưu ý:
- `npm run lint` có `--fix` và chạy trên toàn repo → KHÔNG dùng để kiểm tra; dùng `lint:check` hoặc eslint theo file.
- Build/test cần Prisma client đã generate (`apps/<svc>/src/generated/`) cho user/campaign/operation.
- Hiện repo chưa có file `*.spec.ts` nào và bước test trong CI đang bị comment. Khi viết code mới,
  đặt test cạnh file nguồn: `foo.service.ts` → `foo.service.spec.ts` (jest `testRegex: .*\.spec\.ts$`).

## Code style (ESLint `eslint.config.mjs` + `.prettierrc`)

- Indent **4 spaces**, **double quotes**, **không dấu chấm phẩy**, trailing comma `all`.
- Path alias: `@libs/*`, `libs/*`, `@app/*` (xem `tsconfig.json`, `jest.config.js`).
- Mỗi service theo layered/DDD: `src/{domain,application,infrastructure,presentation,shared}`.
- Đặt tên gRPC theo `.kiro/steering/GRPC_NAMING_CONVENTION.md`.

## Nguyên tắc sửa code (BẮT BUỘC)

1. **Chỉ chỉnh sửa đúng phạm vi file được yêu cầu, không tự ý refactor các module không liên quan đang chạy ổn định.**
2. Không đổi tên/xóa field GraphQL, message/field trong `libs/grpc/proto/*.proto`, hay event Kafka/outbox
   mà không được yêu cầu rõ — các service khác (và client) phụ thuộc vào contract này.
3. Không thêm dependency mới khi chưa được đồng ý. Nếu thêm: `npm install <pkg>` (để npm tự cập nhật lockfile).
4. Thay đổi `libs/**` ảnh hưởng TẤT CẢ service (CI rebuild mọi service) → nêu rõ ảnh hưởng trước khi sửa.
5. Không log/commit secret, token, connection string. Không đọc giá trị trong `.env`.
6. Trước khi báo xong: lint + test phần đã sửa phải pass (Stop hook sẽ tự kiểm tra, xem bên dưới).

## File/Folder CẤM hoặc HẠN CHẾ sửa

**CẤM sửa (đã chặn ở harness):**
- `apps/*/prisma/migrations/**` đã commit — migration đã chạy trên DB thật, sửa sẽ lệch checksum.
- `apps/*/src/generated/**`, `libs/grpc/generated/**` — auto-generated (Prisma / proto). Generate lại bằng lệnh.
- `package-lock.json` — chỉ để npm tự cập nhật khi thêm/xóa dependency.
- `.env`, `.env.*` (trừ `.env.example`), `*.pem`, `*.key`, `*.kubeconfig`.

**HẠN CHẾ (phải hỏi trước):**
- `apps/*/prisma/schema.prisma` — đổi schema = phải tạo migration mới (xem quy trình DB).
- `libs/grpc/proto/*.proto`, `libs/**` — contract dùng chung.
- `k8s/**` (Helm charts, ArgoCD apps, `k8s/config`, `k8s/datadog/datadog-secret.yaml`), `.github/workflows/**`,
  `Dockerfile`, `docker-compose*.y*ml`, `infrastructure/*.json` (Debezium connectors), `scripts/deploy.sh`.
- `seed_data/*.sql` — dump dữ liệu, không chỉnh tay.
- `nest-cli.json`, `tsconfig*.json`, `jest*.config.js`, `eslint.config.mjs`.

## Quy trình thay đổi Database

- KHÔNG chạy SQL DDL trực tiếp (`DROP`, `TRUNCATE`, `ALTER`) qua `psql`, KHÔNG `prisma db push`,
  `prisma migrate reset`, `prisma db execute` (đều bị chặn).
- Đúng quy trình: sửa `schema.prisma` → `cd apps/<svc> && npx prisma migrate dev --create-only --name <ten>`
  → review file SQL mới sinh → commit. Lệnh `migrate dev`/`migrate deploy` luôn cần người duyệt.
- Migration mới (chưa commit) có thể sửa; migration đã commit thì KHÔNG.

## Git

- Nhánh chính: `master`, `develop` (CI chạy trên cả hai). Làm việc trên feature branch.
- CẤM: `git push --force`/`-f`, `git reset --hard`, `git clean -f`, `git checkout/switch master|main|develop`,
  push thẳng lên `master`/`main`/`develop`.

## Harness đã cấu hình

- `.claude/settings.json`: deny rules (package manager lạ, git nguy hiểm, DB destructive, file cấm sửa).
- `.claude/hooks/guard-bash.sh` (PreToolUse/Bash): chặn bằng regex các lệnh nguy hiểm mà prefix-rule bỏ sót.
- `.claude/hooks/guard-edit.sh` (PreToolUse/Edit|Write): chặn sửa migration đã commit, file generated, lockfile, secret.
- `.claude/hooks/stop-verify.sh` (Stop): tự chạy ESLint + Jest (`--findRelatedTests`) trên file `.ts` đã thay đổi;
  nếu fail sẽ chặn việc báo hoàn thành và trả lỗi lại cho agent để sửa.
