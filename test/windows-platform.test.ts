import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { classifyWindowsPort, nativeAncestor, nativeRoot, psQuote, type WindowsProcess } from "../src/windows-platform.js";
import { loadConfig } from "../src/config.js";
import { DesktopQueue } from "../src/desktop-queue.js";
const executable = 'C:\\Program Files\\测试 WorkBuddy\\WorkBuddyAI.exe';
const root: WindowsProcess = { ProcessId: 10, ParentProcessId: 1, ExecutablePath: executable, CommandLine: `"${executable}" --remote-debugging-port=18491` };
test("Windows ownership rejects public listeners, foreign executables and ambiguous owners", () => {
  const owner = { ...root, LocalAddress: '127.0.0.1', OwningProcess: 10 };
  assert.equal(classifyWindowsPort([], executable), 'absent');
  assert.equal(classifyWindowsPort([owner], executable.toUpperCase()), 'native');
  assert.equal(classifyWindowsPort([{ ...owner, LocalAddress: '0.0.0.0' }], executable), 'foreign');
  assert.equal(classifyWindowsPort([{ ...owner, ExecutablePath: 'C:\\Other.exe' }], executable), 'foreign');
  assert.equal(classifyWindowsPort([owner, { ...owner, OwningProcess: 11 }], executable), 'foreign');
});
test("Windows helper follows actual ancestry and rejects standalone Electron CLI and cycles", () => {
  const shell = { ProcessId: 20, ParentProcessId: 10, ExecutablePath: 'C:\\Windows\\powershell.exe', CommandLine: 'powershell.exe' };
  assert.equal(nativeAncestor([root, shell], 20, executable), 10);
  assert.equal(nativeRoot({ ...root, CommandLine: `"${executable}" "cli/bin/codebuddy" --serve` }, executable), false);
  assert.equal(nativeRoot({ ...root, CommandLine: `"${executable}" --type=renderer` }, executable), false);
  assert.equal(nativeAncestor([{ ...shell, ParentProcessId: 20 }], 20, executable), undefined);
});
test("PowerShell paths preserve apostrophes and do not interpolate metacharacters", () => {
  assert.equal(psQuote("C:\\Bob's $folder\\中文 & x"), "'C:\\Bob''s $folder\\中文 & x'");
});
test("Windows discovers native application and desktop history without HOME", { skip: process.platform !== 'win32' }, () => {
  const config = loadConfig();
  assert.equal(path.isAbsolute(config.cliElectronPath), true);
  assert.equal(path.isAbsolute(config.workbuddyConfigDir), true);
  assert.equal(path.basename(config.workbuddyConfigDir), '.workbuddy-ai');
});
