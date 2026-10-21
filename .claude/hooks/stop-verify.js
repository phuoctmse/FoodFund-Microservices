#!/usr/bin/env node
// Stop hook: before the agent may report "done", verify the Go/Python files the AGENT edited this
// session (list kept by track-edits.js). Owner's own uncommitted work is never checked here.
//   Go:     gofmt -l, go vet, go test on the touched packages (per module, nearest go.mod)
//   Python: ruff check (via uv, if the project configures ruff), else py_compile
// On failure the stop is blocked and the errors go back to the agent. Gives up after MAX_BLOCKS.

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
    const sid = input.session_id || "default"
    const listFile = path.join(os.tmpdir(), `foodfund-agent-edits-${sid}.txt`)
    const counterFile = path.join(os.tmpdir(), `foodfund-stop-verify-${sid}`)

    const edited = [...new Set(read(listFile).split("\n").filter(Boolean))].filter((f) => fs.existsSync(f))
    const goFiles = edited.filter((f) => f.endsWith(".go"))
    const pyFiles = edited.filter((f) => f.endsWith(".py"))
    if (goFiles.length + pyFiles.length === 0) {
        clear()
        return done()
    }

    const failures = []
    const skipped = []
    const run = (cmd, args, cwd) => {
        const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NO_COLOR: "1" } })
        if (r.error && r.error.code === "ENOENT") return null
        return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim() }
    }

    // Go: one pass per module, on the packages that contain edited files.
    for (const [mod, files] of groupBy(goFiles, (f) => findUp(path.dirname(f), "go.mod", root))) {
        if (!mod) {
            skipped.push(`${files.length} file .go ngoài module Go`)
            continue
        }
        const rels = files.map((f) => path.relative(mod, f))
        const pkgs = [...new Set(rels.map((f) => "./" + path.dirname(f).split(path.sep).join("/")))]
        const where = path.relative(root, mod) || "."

        const fmt = run("gofmt", ["-l", ...rels], mod)
        if (!fmt) {
            skipped.push("không tìm thấy Go toolchain")
            continue
        }
        if (!fmt.ok || fmt.out) failures.push(`### gofmt -l (${where})\n${fmt.out}\n→ chạy \`gofmt -w\` trên các file trên.`)

        const vet = run("go", ["vet", ...pkgs], mod)
        if (!vet.ok) failures.push(`### go vet ${pkgs.join(" ")} (${where})\n${tail(vet.out)}`)
        else {
            const test = run("go", ["test", ...pkgs], mod)
            if (!test.ok) failures.push(`### go test ${pkgs.join(" ")} (${where})\n${tail(test.out)}`)
        }
    }

    // Python: per project (nearest pyproject.toml).
    for (const [proj, files] of groupBy(pyFiles, (f) => findUp(path.dirname(f), "pyproject.toml", root))) {
        const cwd = proj || root
        const rels = files.map((f) => path.relative(cwd, f))
        const usesRuff = proj && /\bruff\b/.test(read(path.join(proj, "pyproject.toml")))
        const r = usesRuff ? run("uv", ["run", "--frozen", "ruff", "check", ...rels], cwd) : run("python", ["-m", "py_compile", ...rels], cwd) || run("python3", ["-m", "py_compile", ...rels], cwd)
        if (!r) skipped.push(usesRuff ? "không tìm thấy uv" : "không tìm thấy python")
        else if (!r.ok) failures.push(`### ${usesRuff ? "ruff check" : "py_compile"} (${path.relative(root, cwd) || "."})\n${tail(r.out)}`)
    }

    const note = skipped.length ? ` (bỏ qua: ${[...new Set(skipped)].join("; ")})` : ""
    if (failures.length === 0) {
        clear()
        return done(`✓ stop-verify: kiểm tra pass trên ${goFiles.length + pyFiles.length} file agent đã sửa${note}.`)
    }

    const count = Number(read(counterFile) || 0) + 1
    if (count > MAX_BLOCKS) {
        clear()
        return done(`⚠️ stop-verify: vẫn FAIL sau ${MAX_BLOCKS} lần — cần chủ dự án xem.${note}`)
    }
    fs.writeFileSync(counterFile, String(count))
    process.stdout.write(
        JSON.stringify({
            decision: "block",
            reason:
                `[stop-verify ${count}/${MAX_BLOCKS}] Chưa được báo xong: kiểm tra fail trên file agent đã sửa.\n` +
                `Files: ${[...goFiles, ...pyFiles].map((f) => path.relative(root, f)).join(", ")}\n\n${failures.join("\n\n")}\n\n` +
                "Sửa lỗi trong phần agent đã viết. Nếu lỗi nằm ở code chủ dự án đang viết dở (ví dụ test cố ý FAIL theo nhịp TDD), " +
                "KHÔNG sửa code đó: dừng lại và báo cho chủ dự án.",
        }),
    )
    process.exit(0)

    function clear() {
        for (const f of [listFile, counterFile]) {
            try {
                fs.unlinkSync(f)
            } catch {}
        }
    }
})

function findUp(dir, name, stop) {
    for (let d = dir; ; d = path.dirname(d)) {
        if (fs.existsSync(path.join(d, name))) return d
        if (d === stop || path.dirname(d) === d) return ""
    }
}

function groupBy(items, key) {
    const m = new Map()
    for (const it of items) {
        const k = key(it)
        m.set(k, [...(m.get(k) || []), it])
    }
    return m
}

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
