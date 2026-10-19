# AGENTS.md

Mọi AI agent (Claude Code, Cursor, Codex, Kiro, Copilot…) làm việc trên repo này PHẢI tuân theo [`CLAUDE.md`](./CLAUDE.md).

Tóm tắt bắt buộc:
- Package manager: **npm** (`package-lock.json`). Không yarn/pnpm/bun.
- Chỉ chỉnh sửa đúng phạm vi file được yêu cầu, không tự ý refactor module không liên quan đang chạy ổn định.
- Không sửa migration Prisma đã commit, file `src/generated/**`, `package-lock.json`, `.env*`.
- Không thay đổi schema DB ngoài file migration (`prisma db push`, `migrate reset`, SQL DDL trực tiếp đều cấm).
- Không `git push --force`, `git reset --hard`, checkout/push thẳng `master`/`main`/`develop`.
- Trước khi báo xong: `npx eslint <files>` và `npx jest --config jest.config.js --findRelatedTests <files> --passWithNoTests` phải pass.
