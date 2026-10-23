#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit|NotebookEdit) guard for the FoodFund rewrite.
// - Mentor mode: the project owner writes the code in spikes/ and services/ to learn, so every
//   agent edit there needs the owner's approval (permission prompt), never a silent write.
// - Hard blocks: generated code, lockfiles, secrets, committed service migrations, code in plan.md.

const fs = require("fs")
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
    const ti = input.tool_input || {}
    const file = ti.file_path || ti.notebook_path
    if (!file) process.exit(0)

    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
    const abs = path.resolve(root, file)
    const rel = path.relative(root, abs).split(path.sep).join("/")
    if (rel.startsWith("..")) process.exit(0)

    const deny = [
        [/(^|\/)(go\.sum|uv\.lock|package-lock\.json)$/, "Không sửa tay lockfile. Dùng `go mod tidy` / `uv lock` / `npm install`."],
        [/(^|\/)\.env(?!\.example$)(\.[\w.-]+)?$/, "Không sửa .env/.env.docker (secret thật của hệ thống cũ)."],
        [/\.(pem|key|kubeconfig)$|(^|\/)kubeconfig/, "Không sửa file credential/cert."],
    ]
    for (const [re, reason] of deny) {
        if (re.test(rel)) return emit("deny", reason)
    }

    if (isGenerated(abs)) {
        return emit("deny", "File sinh tự động (có dòng `DO NOT EDIT`). Sửa nguồn (query .sql, OpenAPI, .proto) rồi chạy lại `sqlc generate` / `oapi-codegen` / `buf generate`.")
    }

    const tracked = () => spawnSync("git", ["ls-files", "--error-unmatch", rel], { cwd: root }).status === 0
    if (/^(services\/.*\/migrations\/|legacy\/apps\/[^/]+\/prisma\/migrations\/)/.test(rel) && tracked()) {
        return emit("deny", "Migration đã commit không được sửa. Tạo migration goose mới thay vì sửa file cũ.")
    }

    // plan.md is deliberately code-free (AGENTS.md).
    if (/^docs\/spikes\/[^/]+\/plan\.md$/.test(rel)) {
        const added = [ti.content, ti.new_string, ...(ti.edits || []).map((e) => e.new_string)].filter(Boolean).join("\n")
        if (/^\s*(```|~~~)/m.test(added)) {
            return emit("deny", "Plan trong docs/spikes/*/plan.md cố ý không chứa code. Bỏ khối code; nêu tên API/khái niệm và trỏ tới tài liệu.")
        }
    }

    const ask = [
        [/^spikes\//, "Mentor mode: chủ dự án tự viết mọi thứ trong spikes/ (code, test, NOTES.md, journal, AGENTS.md của spike). Agent chỉ sửa khi chủ dự án yêu cầu rõ cho phần này."],
        [/^services\//, "Mentor mode: chủ dự án tự viết code service. Agent chỉ sửa khi chủ dự án yêu cầu rõ cho phần này."],
        [/^docs\/spikes\/[^/]+\/(results|pentest|performance)\.md$/, "File kết quả spike do chủ dự án ghi (lệnh + output thật)."],
        [/^legacy\//, "legacy/ là hệ thống NestJS cũ, chỉ để tham khảo nghiệp vụ."],
    ]
    for (const [re, reason] of ask) {
        if (re.test(rel)) return emit("ask", `${reason} File: ${rel}`)
    }
    process.exit(0)
})

function isGenerated(abs) {
    let head = ""
    try {
        const fd = fs.openSync(abs, "r")
        const buf = Buffer.alloc(1024)
        head = buf.toString("utf8", 0, fs.readSync(fd, buf, 0, 1024, 0))
        fs.closeSync(fd)
    } catch {
        return false
    }
    // Go convention (https://go.dev/s/generatedcode) also used by sqlc, oapi-codegen, buf/protoc.
    return /^\/\/ Code generated .* DO NOT EDIT\.$/m.test(head) || /DO NOT EDIT/.test(head.split("\n").slice(0, 5).join("\n"))
}

function emit(decision, reason) {
    process.stdout.write(
        JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: decision,
                permissionDecisionReason: `[harness] ${reason}`,
            },
        }),
    )
    process.exit(0)
}
