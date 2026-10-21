#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit|NotebookEdit): remember which files the agent changed in this
// session, so stop-verify checks only the agent's work and never the owner's code in progress
// (a red test the owner just wrote is normal TDD, not something the agent should "fix").

const fs = require("fs")
const os = require("os")
const path = require("path")

let raw = ""
process.stdin.on("data", (c) => (raw += c))
process.stdin.on("end", () => {
    try {
        const input = JSON.parse(raw)
        const file = input.tool_input?.file_path || input.tool_input?.notebook_path
        if (!file) return
        const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
        const list = path.join(os.tmpdir(), `foodfund-agent-edits-${input.session_id || "default"}.txt`)
        fs.appendFileSync(list, path.resolve(root, file) + "\n")
    } catch {}
})
