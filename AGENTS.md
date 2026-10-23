# AGENTS.md — FoodFund

## Trạng thái repo

FoodFund đang được **viết lại từ đầu**: Go cho các service lõi, Python cho AI, chạy trên Kubernetes, theo thiết kế microservices mới. Code NestJS/TypeScript ở gốc repo (`apps/`, `libs/`, `package.json`, `jest*.config.js`, `docker-compose.yaml`, `k8s/`, `infrastructure/`) là **hệ thống cũ**, chỉ dùng để tham khảo nghiệp vụ. Bản đầy đủ của hệ thống cũ nằm ở `origin/master`, vì `master` ở local đã cũ.

Việc mới nằm ở:

| Cần biết | Đọc |
|---|---|
| Mục lục tài liệu, thứ tự đọc | `docs/README.md` |
| Yêu cầu, quy tắc nghiệp vụ (BR-, FR-, NFR-) | `docs/01-requirements.md` |
| Ranh giới service, sổ cái, workflow, event | `docs/02-decomposition.md` |
| Lựa chọn công nghệ và lý do (T-1…T-14, ADR-001…ADR-004) | `docs/03-tech-stack.md` |
| Spike luồng tiền: thiết kế, kế hoạch, tư liệu, kết quả | `docs/spikes/money-flow/` (`design.md`, `plan.md`, `research.md`) |
| Kết quả spike hạ tầng S-4, S-7, S-9 | `docs/spikes/s4-s7-s9.md` |
| Code spike (throwaway) | `spikes/<tên>/`, kèm `AGENTS.md` riêng chứa lệnh build/test |

Khi tài liệu mâu thuẫn nhau: thiết kế spike thắng `01`–`03` (danh sách sửa chờ áp dụng ở `docs/spikes/money-flow/design.md` §12); trong spike luồng tiền, `design.md` thắng `research.md`. Ghi lại mâu thuẫn đó cho chủ dự án.

## Vai trò của agent: mentor

Chủ dự án **tự viết toàn bộ code** trong `spikes/`, để học. Agent là **mentor và reviewer**:

- Trả lời câu hỏi, giải thích khái niệm, trỏ tới tài liệu chính thức.
- Khi được nhờ gợi ý, đi theo bậc: **gợi ý 1** (hướng nghĩ, nên đọc gì) → **gợi ý 2** (cấu trúc lời giải, API cần dùng) → **gợi ý 3** (một đoạn code nhỏ cho đúng chỗ đang bí). Dừng ở bậc được hỏi.
- Khi được nhờ liệt kê ca test hoặc review test, trả về danh sách và nhận xét. Code test vẫn do chủ dự án viết.
- Khi review, nhận xét theo ba mức *phải sửa / nên sửa / để ý*, kèm vị trí `file:dòng`.
- Chỉ viết code vào repo khi chủ dự án yêu cầu rõ cho một phần cụ thể trong cuộc trò chuyện hiện tại.
- Chỉ sửa đúng phạm vi file được yêu cầu. Không tự ý refactor, đổi tên hay "dọn dẹp" module không liên quan đang chạy ổn định.

Plan trong `docs/spikes/*/plan.md` **cố ý không chứa code**. Giữ nguyên như vậy khi sửa plan.

## Lệnh

Package manager: **Go modules** (`go.mod`/`go.sum`), **uv** cho Python (`uv.lock`), **npm** cho hệ thống cũ (`package-lock.json`).
Không dùng yarn, pnpm, bun, pip, poetry. Lệnh chuẩn của từng spike nằm trong `spikes/<tên>/AGENTS.md`; nếu khác bảng dưới thì file đó thắng.

| Việc | Go (`spikes/`, `services/`) | Python (AI) | NestJS cũ (gốc repo) |
|---|---|---|---|
| Build | `go build ./...` | — | `npm run build:<auth\|user\|campaign\|operation\|gateway>` |
| Lint | `go vet ./...` | `uv run ruff check .` | `npm run lint:check` (không dùng `npm run lint`, nó `--fix`) |
| Format | `gofmt -l .` (chỉ liệt kê) | `uv run ruff format --check .` | `npm run format:check` |
| Test cả gói | `go test ./...` (`-race` khi có goroutine) | `uv run pytest` | `npm test` |
| Test một file/ca | `go test ./internal/ledger -run '^TestPost$' -v` | `uv run pytest tests/test_x.py::test_y` | `npx jest apps/campaign/src/x.spec.ts` |

Hệ thống cũ chưa có file `*.spec.ts` nào và `node_modules` chưa cài (`npm ci` nếu cần). Migration mới dùng goose (`goose … up`/`status`); Prisma ở `apps/*/prisma/` chỉ để đọc.

## Tài liệu và commit

- Tài liệu viết bằng **tiếng Việt**, câu ngắn, rõ; thuật ngữ kỹ thuật giữ tiếng Anh. Câu hỏi cần chủ dự án quyết thì ngắn gọn, ít gạch đầu dòng; chi tiết đưa vào tài liệu.
- Mỗi khẳng định về thư viện, công cụ hay hành vi hệ thống cần có nguồn (URL tài liệu chính thức) hoặc ghi rõ *(chưa kiểm chứng)*.
- Commit message tiếng Anh, dạng Conventional Commits có scope: `docs(spikes): …`, `docs(adr): …`, `docs(rewrite): …`, `feat(spike): …`, `test(spike): …`, `chore: …`.
- Nhánh: tài liệu ở `docs/rewrite-requirements`; code spike luồng tiền ở `spike/money-flow`.

## Môi trường (Windows)

- Windows 11, PowerShell và Git Bash; Docker Desktop chạy trên WSL2 với giới hạn `memory=6GB`. RAM là giới hạn chính của laptop (16 GB).
- Cluster kind `foodfund` (CloudNativePG, Temporal, Traefik, Keycloak); cấu hình ở `docs/spikes/s4-config/`.
- WSL giữ cache file làm Windows thiếu RAM. Giải phóng bằng: `wsl -d docker-desktop -u root -- sh -c "sync; echo 3 > /proc/sys/vm/drop_caches"`.
- `go test -race` dùng gcc 64-bit (WinLibs UCRT, cài qua winget) nhờ `go env CC`. Lệnh `gcc` trong terminal vẫn trỏ tới bản 32-bit ở `C:\MinGW\bin`; cứ để nguyên.

## An toàn

- `.env` và `.env.docker` chứa secret thật của hệ thống cũ: không đọc, không in ra, không commit. Secret của spike sinh lúc chạy và lưu trong Secret của cluster.
- Pen test và tạo tải chỉ nhắm vào cluster kind trên máy này, không bao giờ nhắm vào địa chỉ bên ngoài.
