#!/usr/bin/env node
// PreToolUse(Bash) guard for the FoodFund rewrite (Go + Python on kind).
// Regex backstop for .claude/settings.json: catches variants prefix rules miss
// (`cd x && pip install`, `git push origin HEAD -f`, SQL piped into psql, scans aimed at outside hosts).

const { spawnSync } = require("child_process")

let raw = ""
process.stdin.on("data", (c) => (raw += c))
process.stdin.on("end", () => {
    let cmd = ""
    try {
        cmd = JSON.parse(raw).tool_input?.command || ""
    } catch {
        process.exit(0)
    }
    // Command rules ignore quoted strings and heredoc bodies, so `grep "pip install" docs/`
    // or a commit message that mentions `git push --force` is not blocked.
    // Payloads run through `sh -c` / `bash -c` / `eval` are still checked in full.
    const full = cmd.replace(/\s+/g, " ")
    const stripped = cmd
        .replace(/<<-?\s*['"]?(\w+)['"]?[^\n]*\n[\s\S]*?\n\s*\1\s*(\n|$)/g, " <<HEREDOC\n")
        .replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''")
        .replace(/\s+/g, " ")
    const c = /\b(ba|z)?sh\s+-c\b|\beval\b/.test(full) ? full : stripped
    const SEP = "(?:^|[\\s;&|(`$'\"])"

    const deny = [
        [new RegExp(`${SEP}(pip3?|pipx)\\s+install\\b|python3?\\s+-m\\s+pip\\s+install\\b|${SEP}(poetry|pipenv)(\\s|$)|${SEP}conda\\s+install\\b`), "Python dùng uv (`uv add`, `uv sync`, `uv run`). Không dùng pip/poetry/pipenv/conda."],
        [/\bnpx\s+(-y|--yes)\b/, "Không dùng `npx -y` (tự tải package lạ)."],
        [/\bgit\s+push\b.*(\s--force(?!-with-lease)\b|\s-[a-zA-Z]*f\b|\s\+\S)/, "Cấm force push."],
        [/\bgit\s+push\b[^;&|]*[\s:](master|main|develop)(\s|$|[;&|])/, "Cấm push lên master/main/develop."],
        [/\bgit\s+push\b[^;&|]*(\s--delete\b|\s-d\b|\s:[\w./-]+)/, "Cấm xoá nhánh trên remote."],
        [/\bgit\s+reset\b.*\s--hard\b/, "Cấm `git reset --hard` (mất code chưa commit của chủ dự án)."],
        [/\bgit\s+clean\b.*\s-[a-zA-Z]*f/, "Cấm `git clean -f` (xoá file untracked, có thể là code/nhật ký đang viết)."],
        [/\bgit\s+(checkout|switch)\s+(-[^\s]+\s+)*(origin\/)?(master|main|develop)(\s|$|[;&|])/, "Không checkout master/main/develop: hệ thống cũ, local master đã cũ. Làm trên docs/rewrite-requirements hoặc spike/*."],
        [/\bgit\s+(checkout|restore)\s+(?![^;&|]*--staged)(\S+\s+)*(--\s+)?\.(\s|$)/, "Cấm huỷ toàn bộ thay đổi trong working tree."],
        [/\bgit\s+stash\s+(drop|clear)\b/, "Cấm xoá stash."],
        [new RegExp(`${SEP}dropdb\\s`), "Cấm xoá database."],
        [/\brm\s+-[a-zA-Z]*r[a-zA-Z]*\b[^;&|]*(migrations|journal|\s\.git(\/|\s|$))/, "Cấm xoá thư mục migrations, journal hoặc .git."],
        [/\bwsl(\.exe)?\s+--unregister\b/, "Cấm `wsl --unregister` (xoá distro, mất dữ liệu Docker/kind)."],
        [/\b(cat|less|more|head|tail|bat|type|cp|scp|grep|rg)\b[^;&|]*[\s/]\.env(?!\.example)(\.[\w.-]+)?(\s|$)/, "Không đọc/copy .env, .env.docker (secret thật của hệ thống cũ)."],
    ]

    // Schema changes go through goose migrations; no DDL straight into a database.
    const sqlClient = /\b(psql|pgcli|sqlcmd|pg_restore)\b/
    const ddl = /\b(DROP|TRUNCATE)\s+(TABLE|SCHEMA|DATABASE|TYPE|INDEX|VIEW|ROLE|OWNED)\b|\bALTER\s+(TABLE|TYPE|SCHEMA|ROLE|DEFAULT\s+PRIVILEGES)\b|\bCREATE\s+(TABLE|SCHEMA|ROLE|TRIGGER)\b|\b(GRANT|REVOKE)\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i
    if (sqlClient.test(full) && ddl.test(full)) {
        deny.push([/./, "Cấm chạy DDL/GRANT/DELETE trực tiếp vào DB. Đổi schema/quyền phải qua file migration goose (hoặc migrations/bootstrap/roles.sql)."])
    }

    // Pen test / load test only against the local kind cluster (AGENTS.md "An toàn", D-21).
    const attackTool = /\b(k6|zap(-api-scan|-baseline|-full-scan)?(\.py|\.sh)?|schemathesis|st\s+run|nmap|sqlmap|nikto|nuclei|ffuf|gobuster|hey|vegeta|wrk|ab|hping3?)\b/
    if (attackTool.test(c)) {
        const hosts = [...full.matchAll(/\b(?:https?|wss?):\/\/([^\s/:'"]+)/g)].map((m) => m[1].toLowerCase())
        const outside = hosts.filter((h) => !isLocalHost(h))
        if (outside.length) {
            deny.push([/./, `Pen test/tạo tải chỉ được nhắm vào cluster kind trên máy này. Host ngoài: ${outside.join(", ")}`])
        }
    }

    for (const [re, reason] of deny) {
        if (re.test(c)) return emit("deny", `[harness] ${reason}`)
    }

    const ask = [
        [/\bgo\s+(get|install)\b|\buv\s+(add|remove|pip\s+install)\b|\bnpm\s+(install|i|uninstall|remove|update)\s+\S/, "Thêm/đổi dependency: plan chốt phiên bản cụ thể — cần chủ dự án duyệt."],
        [/\bgoose\b[^;&|]*\s(down|down-to|reset|redo|fix)\b/, "goose down/reset/redo đổi schema DB — cần chủ dự án duyệt."],
        [/\bkind\s+delete\b/, "Xoá cluster kind (dựng lại mất vài phút) — cần chủ dự án duyệt."],
        [/\bdocker\s+(system|volume|image|container|builder)\s+prune\b|\bdocker\s+volume\s+rm\b/, "Docker prune/volume rm có thể xoá dữ liệu kind/Postgres — cần chủ dự án duyệt."],
        [/\bwsl(\.exe)?\s+(--shutdown|--terminate|-t)\b/, "Tắt WSL sẽ dừng Docker Desktop và cluster kind — cần chủ dự án duyệt."],
    ]
    for (const [re, reason] of ask) {
        if (re.test(c)) return emit("ask", `[harness] ${reason}`)
    }

    // Cluster changes are routine on kind; anything else needs a human.
    const kubeMutate = /\bkubectl\b[^;&|]*\s(delete|apply|create|edit|patch|replace|scale|rollout|drain|cordon|taint|label|annotate)\b|\bhelm\b[^;&|]*\s(install|upgrade|uninstall|rollback|delete)\b/
    if (kubeMutate.test(c)) {
        const ctx = kubeContext(full)
        if (!/^kind-/.test(ctx)) {
            return emit("ask", `[harness] Lệnh thay đổi cluster nhưng context hiện tại là "${ctx || "không xác định"}", không phải kind — cần chủ dự án duyệt.`)
        }
    }
    process.exit(0)
})

function isLocalHost(h) {
    return (
        /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?|host\.docker\.internal|kubernetes\.docker\.internal)$/.test(h) ||
        /\.(localhost|local|svc|svc\.cluster\.local|cluster\.local|internal)$/.test(h) ||
        /^(10\.\d+|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+$/.test(h) ||
        /^[a-z0-9-]+$/.test(h) // bare service name inside the cluster
    )
}

function kubeContext(command) {
    const flag = command.match(/--(?:kube-)?context[= ](\S+)/)
    if (flag) return flag[1]
    const r = spawnSync("kubectl", ["config", "current-context"], { encoding: "utf8", timeout: 3000 })
    return r.status === 0 ? r.stdout.trim() : ""
}

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
