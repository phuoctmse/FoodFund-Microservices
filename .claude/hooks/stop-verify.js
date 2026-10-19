#!/usr/bin/env node
// Stop hook: before the agent may report "done", run ESLint + related Jest tests on the .ts files
// changed on this branch (committed vs base + uncommitted + untracked). On failure, block the stop
// and hand the errors back to the agent. Gives up blocking after MAX_BLOCKS attempts to avoid loops.

const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

const MAX_BLOCKS = 3
const MAX_OUTPUT = 6000

let raw = ""
process.stdin.on("data", (c) => (raw += c))
process.stdin.on("end", () => {
    let input = {}
    try {
        input = JSON.parse(raw || "{}")
    } catch {}
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
    const counterFile = path.join(os.tmpdir(), `foodfund-stop-verify-${input.session_id || "default"}`)

    const git = (...args) => {
        const r = spawnSync("git", args, { cwd: root, encoding: "utf8" })
        return r.status === 0 ? r.stdout.trim() : ""
    }

    const baseRef = ["origin/develop", "origin/master", "origin/main", "master"].find((ref) =>
        git("rev-parse", "--verify", "--quiet", ref),
    )
    const base = baseRef ? git("merge-base", "HEAD", baseRef) : ""
    const changed = new Set(
        [
            base ? git("diff", "--name-only", "--diff-filter=ACMR", base) : "",
            git("diff", "--name-only", "--diff-filter=ACMR", "HEAD"),
            git("ls-files", "--others", "--exclude-standard"),
        ]
            .join("\n")
            .split("\n")
            .filter(Boolean),
    )

    const files = [...changed].filter(
        (f) =>
            /^(apps|libs)\/.*\.ts$/.test(f) &&
            !/\.d\.ts$/.test(f) &&
            !/\/generated\/|\/prisma\/migrations\/|\/node_modules\//.test(f) &&
            fs.existsSync(path.join(root, f)),
    )
    if (files.length === 0) return done()

    // Resolve by path: eslint's package "exports" hides bin/ from require.resolve.
    const eslintBin = path.join(root, "node_modules", "eslint", "bin", "eslint.js")
    const jestBin = path.join(root, "node_modules", "jest", "bin", "jest.js")
    if (!fs.existsSync(eslintBin) || !fs.existsSync(jestBin)) {
        return done("⚠️ stop-verify: chưa có node_modules (chạy `npm ci`) — bỏ qua lint/test.")
    }

    const run = (bin, args) =>
        spawnSync(process.execPath, [bin, ...args], {
            cwd: root,
            encoding: "utf8",
            env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
            maxBuffer: 64 * 1024 * 1024,
        })

    const failures = []
    const lint = run(eslintBin, ["--no-warn-ignored", ...files])
    if (lint.status !== 0) failures.push(`### ESLint (exit ${lint.status})\n${tail(lint.stdout + lint.stderr)}`)

    const test = run(jestBin, ["--config", "jest.config.js", "--findRelatedTests", ...files, "--passWithNoTests", "--silent"])
    if (test.status !== 0) failures.push(`### Jest (exit ${test.status})\n${tail(test.stdout + test.stderr)}`)

    if (failures.length === 0) {
        reset()
        return done(`✓ stop-verify: ESLint + Jest pass trên ${files.length} file .ts đã thay đổi.`)
    }

    const count = Number(read(counterFile) || 0) + 1
    if (count > MAX_BLOCKS) {
        reset()
        return done(`⚠️ stop-verify: lint/test vẫn FAIL sau ${MAX_BLOCKS} lần sửa — cần người kiểm tra.`)
    }
    fs.writeFileSync(counterFile, String(count))
    process.stdout.write(
        JSON.stringify({
            decision: "block",
            reason:
                `[stop-verify ${count}/${MAX_BLOCKS}] Chưa được báo hoàn thành: lint/test fail trên phần code đã sửa.\n` +
                `Files: ${files.join(", ")}\n\n${failures.join("\n\n")}\n\n` +
                "Hãy sửa lỗi (chỉ trong phạm vi file liên quan), rồi kết thúc lại.",
        }),
    )
    process.exit(0)

    function reset() {
        try {
            fs.unlinkSync(counterFile)
        } catch {}
    }
})

function done(message) {
    if (message) process.stdout.write(JSON.stringify({ systemMessage: message }))
    process.exit(0)
}

function read(file) {
    try {
        return fs.readFileSync(file, "utf8")
    } catch {
        return ""
    }
}

function tail(s) {
    s = (s || "").trim()
    return s.length > MAX_OUTPUT ? "…(truncated)\n" + s.slice(-MAX_OUTPUT) : s
}
