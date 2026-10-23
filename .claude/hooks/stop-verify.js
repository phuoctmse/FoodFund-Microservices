#!/usr/bin/env node
// Stop hook: before the agent may report "done", verify the Go/Python files the AGENT edited this
// session (list kept by track-edits.js). Owner's own uncommitted work is never checked here.
//   Go:     gofmt -l, go vet, go test on the touched packages (per module, nearest go.mod)
//   Python: ruff check (via uv, if the project configures ruff), else py_compile; then pytest on the
//           related test files (test_<name>.py / <name>_test.py) if the project uses pytest
//   TS:     eslint + jest --findRelatedTests (legacy NestJS), only when node_modules is installed
//   JS:     node --check (e.g. the harness hooks themselves)
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
    const tsFiles = edited.filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts"))
    const jsFiles = edited.filter((f) => /\.[cm]?js$/.test(f))
    const checked = [...goFiles, ...pyFiles, ...tsFiles, ...jsFiles]
    if (checked.length === 0) {
        clear()
        return done()
    }

    const failures = []
    const skipped = []
    const run = (cmd, args, cwd) => {
        const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NO_COLOR: "1" } })
        if (r.error && r.error.code === "ENOENT") return null
        return { ok: r.status === 0, status: r.status, out: `${r.stdout || ""}${r.stderr || ""}`.trim() }
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
        const pyproject = proj ? read(path.join(proj, "pyproject.toml")) : ""
        const usesRuff = /\bruff\b/.test(pyproject)
        const r = usesRuff ? run("uv", ["run", "--frozen", "ruff", "check", ...rels], cwd) : run("python", ["-m", "py_compile", ...rels], cwd) || run("python3", ["-m", "py_compile", ...rels], cwd)
        if (!r) skipped.push(usesRuff ? "không tìm thấy uv" : "không tìm thấy python")
        else if (!r.ok) failures.push(`### ${usesRuff ? "ruff check" : "py_compile"} (${path.relative(root, cwd) || "."})\n${tail(r.out)}`)
        else if (/\bpytest\b/.test(pyproject)) {
            const tests = relatedPyTests(files, proj).map((f) => path.relative(cwd, f))
            if (tests.length === 0) skipped.push("không có file test pytest liên quan")
            else {
                const t = run("uv", ["run", "--frozen", "pytest", "-q", ...tests], cwd)
                // Exit code 5 = no tests collected (https://docs.pytest.org/en/stable/reference/exit-codes.html).
                if (!t) skipped.push("không tìm thấy uv")
                else if (!t.ok && t.status !== 5) failures.push(`### pytest ${tests.join(" ")} (${path.relative(root, cwd) || "."})\n${tail(t.out)}`)
            }
        }
    }

    // Legacy NestJS: only when `npm ci` has been run; the repo has no *.spec.ts yet, so jest may find nothing.
    if (tsFiles.length) {
        const eslint = path.join(root, "node_modules", "eslint", "bin", "eslint.js")
        const jest = path.join(root, "node_modules", "jest", "bin", "jest.js")
        const rels = tsFiles.map((f) => path.relative(root, f).split(path.sep).join("/"))
        if (!fs.existsSync(eslint)) skipped.push("chưa có node_modules nên bỏ qua eslint/jest")
        else {
            const lint = run(process.execPath, [eslint, ...rels], root)
            if (!lint.ok) failures.push(`### eslint\n${tail(lint.out)}`)
            else if (fs.existsSync(jest)) {
                const t = run(process.execPath, [jest, "--config", "jest.config.js", "--passWithNoTests", "--findRelatedTests", ...rels], root)
                if (!t.ok) failures.push(`### jest --findRelatedTests\n${tail(t.out)}`)
            }
        }
    }

    for (const f of jsFiles) {
        const r = run(process.execPath, ["--check", f], root)
        if (!r.ok) failures.push(`### node --check ${path.relative(root, f)}\n${tail(r.out)}`)
    }

    const note = skipped.length ? ` (bỏ qua: ${[...new Set(skipped)].join("; ")})` : ""
    if (failures.length === 0) {
        clear()
        return done(`✓ stop-verify: kiểm tra pass trên ${checked.length} file agent đã sửa${note}.`)
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
                `Files: ${checked.map((f) => path.relative(root, f)).join(", ")}\n\n${failures.join("\n\n")}\n\n` +
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

// Edited test files, plus test_<name>.py / <name>_test.py for each edited module, anywhere in the project.
function relatedPyTests(files, proj) {
    const isTest = (f) => /^test_.*\.py$|_test\.py$/.test(path.basename(f))
    const wanted = new Set(files.filter((f) => !isTest(f)).flatMap((f) => [`test_${path.basename(f)}`, path.basename(f).replace(/\.py$/, "_test.py")]))
    const found = files.filter(isTest)
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.isDirectory()) {
                if (!/^(\.|__pycache__$|node_modules$)/.test(e.name)) walk(path.join(dir, e.name))
            } else if (wanted.has(e.name)) found.push(path.join(dir, e.name))
        }
    }
    if (proj && wanted.size) walk(proj)
    return [...new Set(found)]
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
