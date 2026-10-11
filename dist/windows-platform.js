import path from "node:path";
import { execFileSync } from "node:child_process";
export function psQuote(value) { return `'${value.replaceAll("'", "''")}'`; }
export const powershell = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
export function runPowerShell(script, timeout = 15000) {
    const modulePath = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "Modules");
    try {
        return execFileSync(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(`$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); ${script}`, "utf16le").toString("base64")], { encoding: "utf8", timeout, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PSModulePath: modulePath } });
    }
    catch (error) {
        const failure = error;
        const stderr = String(failure.stderr ?? "");
        const text = stderr.startsWith("#< CLIXML") ? [...stderr.matchAll(/<S S="Error">([\s\S]*?)<\/S>/g)].map(match => match[1]).join("").replaceAll("_x000D__x000A_", "\n").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&") : stderr;
        throw new Error(`Windows platform command failed (${failure.code ?? failure.status ?? "unknown"}): ${text.slice(0, 1200).trim()}`);
    }
}
export function windowsProcesses() {
    return JSON.parse(runPowerShell("ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine)"));
}
export function sameExecutable(a, b) { return Boolean(a && path.win32.resolve(a).toLowerCase() === path.win32.resolve(b).toLowerCase()); }
export function nativeRoot(process, executable) {
    if (!sameExecutable(process.ExecutablePath, executable) || !process.CommandLine)
        return false;
    // A native root may have ordinary Electron flags; a standalone script/CLI may not impersonate it.
    const line = process.CommandLine.trim();
    const tail = line.startsWith('"') ? line.slice(line.indexOf('"', 1) + 1).trim() : line.slice((process.ExecutablePath ?? "").length).trim();
    return (!tail || tail.startsWith("--")) && !/--type(?:=|\s)|--stdio|--serve|cli[\\/]|sidecar-entry|daemon-app-server|\.\w+\s/i.test(tail);
}
export function nativeAncestor(processes, parentPid, executable) {
    const byPid = new Map(processes.map(item => [item.ProcessId, item]));
    const seen = new Set();
    for (let step = 0; parentPid > 0 && step < 40 && !seen.has(parentPid); step++) {
        seen.add(parentPid);
        const item = byPid.get(parentPid);
        if (!item)
            return undefined;
        if (nativeRoot(item, executable))
            return item.ProcessId;
        parentPid = item.ParentProcessId;
    }
}
export function windowsPortOwners(port) {
    if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error("Invalid port");
    return JSON.parse(runPowerShell(`ConvertTo-Json -Compress -InputObject @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq ${port} | ForEach-Object { $p=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$_.OwningProcess); [pscustomobject]@{LocalAddress=$_.LocalAddress; OwningProcess=$_.OwningProcess; ExecutablePath=$p.ExecutablePath; CommandLine=$p.CommandLine} })`));
}
export function classifyWindowsPort(owners, executable) {
    if (!owners.length)
        return "absent";
    if (new Set(owners.map(item => item.OwningProcess)).size !== 1 || owners.some(item => !["127.0.0.1", "::1"].includes(item.LocalAddress)))
        return "foreign";
    return owners.every(item => nativeRoot({ ...item, ProcessId: item.OwningProcess, ParentProcessId: 0 }, executable)) ? "native" : "foreign";
}
//# sourceMappingURL=windows-platform.js.map