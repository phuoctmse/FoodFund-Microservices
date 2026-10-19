#!/usr/bin/env node
// PreToolUse(Bash) guard: regex-level backstop for the deny rules in .claude/settings.json.
// Prefix rules miss variants like `cd x && yarn`, `git push origin HEAD -f`, or SQL piped into psql.

let raw = ""
process.stdin.on("data", (c) => (raw += c))
process.stdin.on("end", () => {
    let cmd = ""
    try {
        cmd = JSON.parse(raw).tool_input?.command || ""
    } catch {
        process.exit(0)
    }
    const c = cmd.replace(/\s+/g, " ")
    const SEP = "(?:^|[\\s;&|(`$])"

    const deny = [
        [new RegExp(`${SEP}(yarn|pnpm|pnpx|bun|bunx)(\\s|$)`), "Dự án dùng npm (package-lock.json). Không dùng yarn/pnpm/bun."],
        [/\bnpx\s+(-y|--yes)\b/, "Không dùng `npx -y` (tự tải package lạ). Chỉ dùng binary đã có trong node_modules."],
        [/\bgit\s+push\b.*(\s--force(?!-with-lease)\b|\s-[a-zA-Z]*f\b|\s\+\S)/, "Cấm force push."],
        [/\bgit\s+push\b[^;&|]*[\s:](master|main|develop)(\s|$|[;&|])/, "Cấm push thẳng lên master/main/develop. Hãy push feature branch và tạo PR."],
        [/\bgit\s+reset\b.*\s--hard\b/, "Cấm `git reset --hard` (mất thay đổi không khôi phục được)."],
        [/\bgit\s+clean\b.*\s-[a-zA-Z]*f/, "Cấm `git clean -f` (xóa file untracked)."],
        [/\bgit\s+(checkout|switch)\s+(-[^\s]+\s+)*(origin\/)?(master|main|develop)(\s|$|[;&|])/, "Cấm checkout/switch sang master/main/develop. Làm việc trên feature branch."],
        [/\bprisma\s+(db\s+push|migrate\s+reset|db\s+execute)\b/, "Cấm thay đổi schema DB ngoài migration (db push / migrate reset / db execute)."],
        [/--accept-data-loss|--force-reset/, "Cấm cờ gây mất dữ liệu của Prisma."],
        [new RegExp(`${SEP}dropdb\\s`), "Cấm xóa database."],
        [/\brm\s+-[a-zA-Z]*r[a-zA-Z]*\b[^;&|]*(prisma\/migrations|\s\.git(\/|\s|$))/, "Cấm xóa thư mục migrations hoặc .git."],
        [/\b(cat|less|more|head|tail|bat|type|cp|scp)\b[^;&|]*[\s/]\.env(?!\.example)(\.[\w.-]+)?(\s|$)/, "Không đọc/copy file .env (chứa secret). Dùng .env.example để xem tên biến."],
    ]

    const sqlClient = /\b(psql|pgcli|mysql|sqlcmd|pg_restore)\b|prisma\s+db\s+execute/
    const ddl = /\b(DROP|TRUNCATE)\s+(TABLE|SCHEMA|DATABASE|TYPE|INDEX|VIEW)\b|\bALTER\s+(TABLE|TYPE|SCHEMA)\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i
    if (sqlClient.test(c) && ddl.test(c)) {
        deny.push([/./, "Cấm chạy DDL/DELETE trực tiếp lên DB. Thay đổi schema phải qua file migration Prisma."])
    }

    for (const [re, reason] of deny) {
        if (re.test(c)) return emit("deny", `[harness] ${reason}`)
    }

    const ask = [
        [/\bprisma\s+migrate\s+(dev|deploy|resolve)\b|npm\s+run\s+prisma:(migrate|deploy|seed)/, "Lệnh migration chạm vào DB thật — cần người duyệt."],
        [/\bkubectl\s+(delete|apply|edit|patch|scale|replace|rollout)\b|\bhelm\s+(install|upgrade|uninstall|rollback)\b|\bargocd\s+app\s+(sync|delete)\b/, "Thay đổi cluster Kubernetes — cần người duyệt."],
        [/\bnpm\s+(install|i|uninstall|remove|update)\s+\S/, "Thêm/xóa dependency sẽ đổi package-lock.json — cần người duyệt."],
    ]
    for (const [re, reason] of ask) {
        if (re.test(c)) return emit("ask", `[harness] ${reason}`)
    }
    process.exit(0)
})

function emit(decision, reason) {
    process.stdout.write(
        JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: decision,
                permissionDecisionReason: reason,
            },
        }),
    )
    process.exit(0)
}
