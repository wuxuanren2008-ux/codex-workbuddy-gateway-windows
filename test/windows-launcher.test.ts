import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("Node launcher loads local env, keeps caller cwd and literal arguments in paths with spaces", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gateway launch 空格 ' "));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "scripts")); fs.mkdirSync(path.join(root, "dist"));
  fs.copyFileSync(fileURLToPath(new URL("../scripts/launch.mjs", import.meta.url)), path.join(root, "scripts", "launch.mjs"));
  fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
  fs.writeFileSync(path.join(root, ".env"), 'WORKBUDDY_LAUNCHER_TEST="local config"\n');
  fs.writeFileSync(path.join(root, "dist", "server.js"), 'console.log(JSON.stringify({cwd:process.cwd(),caller:process.env.AGENT_HUB_CALLER_CWD,value:process.env.WORKBUDDY_LAUNCHER_TEST,args:process.argv.slice(2)}))');
  const env = { ...process.env }; delete env.AGENT_HUB_CALLER_CWD; delete env.WORKBUDDY_LAUNCHER_TEST;
  const result = JSON.parse(execFileSync(process.execPath, [path.join(root, "scripts", "launch.mjs"), "gateway", "a'b $() & 中文"], { cwd: os.tmpdir(), env, encoding: "utf8" }));
  assert.equal(result.cwd, root); assert.equal(result.caller, os.tmpdir()); assert.equal(result.value, "local config");
  assert.deepEqual(result.args, ["a'b $() & 中文"]);
});
