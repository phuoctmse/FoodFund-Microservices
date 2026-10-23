@AGENTS.md

# Harness Claude Code

Luật chung, vai trò mentor và môi trường nằm ở `AGENTS.md` (import ở trên). Phần này chỉ mô tả những gì
harness trong `.claude/` tự động ép, để agent biết vì sao một lệnh bị chặn hoặc bị hỏi.

## Hỏi chủ dự án trước khi sửa (mentor mode)

- Mọi file trong `spikes/` và `services/`: code, test, `NOTES.md`, `journal/`, `AGENTS.md` của spike.
- `docs/spikes/*/results.md`, `pentest.md`, `performance.md`: kết quả spike do chủ dự án ghi.
- `apps/`, `libs/`: code NestJS của hệ thống cũ, chỉ để tham khảo.
- Thêm hoặc đổi dependency (`go get`, `go install`, `uv add`, `npm install <pkg>`): plan chốt phiên bản cụ thể.
- `goose down`/`reset`/`redo`, `kind delete`, `docker … prune`, `wsl --shutdown`.
- Thay đổi cluster (`kubectl apply`/`delete`…, `helm install`/`upgrade`…) khi context không phải `kind-*`.
  Trên `kind-foodfund` thì chạy bình thường.

Khi bị hỏi, giải thích ngắn agent định sửa gì và vì sao. Không tìm cách lách (sửa qua `sed`, `cat >`…).

## Bị chặn hẳn

- `pip`/`poetry`/`pipenv`/`conda`: Python dùng `uv`. `yarn`/`pnpm`/`bun`/`bunx`: JS của repo dùng npm.
- `prisma db push`, `prisma db execute`, `prisma migrate reset`: đổi hoặc xoá schema ngoài file migration.
  `prisma migrate dev|deploy|resolve` và `npm run prisma:migrate*|deploy*|seed*` thì bị hỏi.
- Git: force push; push lên `master`/`main`/`develop`; xoá nhánh remote; `reset --hard`; `clean -f`;
  `checkout .`/`restore .`; `stash drop`/`clear`; checkout `master`/`main`/`develop`.
- DDL, `GRANT`/`REVOKE`, `DELETE` qua `psql`: đổi schema và quyền phải qua migration goose
  (hoặc `migrations/bootstrap/roles.sql`). `dropdb`. Xoá thư mục `migrations/`, `journal/`, `.git`.
- k6, ZAP, schemathesis, nmap… nhắm vào host ngoài máy (chỉ cho phép localhost, IP nội bộ, `*.svc`, `*.localhost`).
- Sửa file có dòng `DO NOT EDIT` (code sinh bởi sqlc, oapi-codegen, buf); sửa `go.sum`, `uv.lock`, `package-lock.json`;
  sửa migration đã commit trong `services/` hoặc `apps/*/prisma/migrations/`; đọc hoặc sửa `.env`, `.env.docker`, `*.pem`, `*.key`.
- Khối code trong `docs/spikes/*/plan.md`.

## Stop hook

Trước khi agent báo xong, `stop-verify.js` kiểm tra **chỉ những file agent đã sửa trong phiên**
(`track-edits.js` ghi lại), không đụng code chủ dự án đang viết dở:

- Go (theo `go.mod` gần nhất): `gofmt -l`, `go vet`, `go test` trên package chứa file đã sửa.
- Python (theo `pyproject.toml` gần nhất): `uv run ruff check` nếu project dùng ruff, nếu không thì `py_compile`;
  sau đó `uv run pytest` trên file test liên quan (`test_<tên>.py`, `<tên>_test.py`) nếu project dùng pytest.
- TypeScript (hệ thống cũ): `eslint` và `jest --findRelatedTests`, chỉ khi đã có `node_modules`.
- JavaScript (ví dụ hook trong `.claude/hooks/`): `node --check`.

Fail thì agent phải sửa phần mình viết, tối đa 3 lần. Nếu lỗi nằm ở code của chủ dự án (ví dụ test đang FAIL
theo nhịp TDD), dừng lại và báo, không sửa hộ.
