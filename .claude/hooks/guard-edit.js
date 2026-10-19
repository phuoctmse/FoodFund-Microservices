#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit|NotebookEdit) guard for protected files.
// Committed Prisma migrations are blocked; a freshly generated (untracked) migration may still be edited.

const path = require("path")
const { spawnSync } = require("child_process")

let raw = ""
process.stdin.on("data", (c) => (raw += c))
process.stdin.on("end", () => {
    let input
    try {
        input = JSON.parse(raw)
    } catch {
        process.exit(0)
    }
    const file = input.tool_input?.file_path || input.tool_input?.notebook_path
    if (!file) process.exit(0)

    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
    const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join("/")
    if (rel.startsWith("..")) process.exit(0)

    const rules = [
        [/^apps\/[^/]+\/src\/generated\//, "File auto-generated bởi Prisma. Sửa schema.prisma rồi chạy `npm run prisma:generate:<svc>`."],
        [/^libs\/grpc\/generated\//, "File auto-generated từ .proto. Sửa libs/grpc/proto/*.proto thay vì file này."],
        [/(^|\/)package-lock\.json$/, "Không sửa tay lockfile. Dùng `npm install <pkg>` để npm tự cập nhật."],
        [/(^|\/)\.env(?!\.example$)(\.[\w.-]+)?$/, "Không sửa file .env (secret). Chỉ cập nhật .env.example nếu thêm biến mới."],
        [/\.(pem|key|kubeconfig)$|(^|\/)kubeconfig/, "Không sửa file credential/cert."],
    ]
    for (const [re, reason] of rules) {
        if (re.test(rel)) return deny(reason)
    }

    if (/^apps\/[^/]+\/prisma\/migrations\//.test(rel)) {
        const tracked = spawnSync("git", ["ls-files", "--error-unmatch", rel], { cwd: root }).status === 0
        if (tracked || /migration_lock\.toml$/.test(rel)) {
            return deny("Migration đã commit (đã/sẽ chạy trên DB thật) — không được sửa. Tạo migration mới: `cd apps/<svc> && npx prisma migrate dev --create-only --name <ten>`.")
        }
    }
    process.exit(0)
})

function deny(reason) {
    process.stdout.write(
        JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: `[harness] ${reason}`,
            },
        }),
    )
    process.exit(0)
}
