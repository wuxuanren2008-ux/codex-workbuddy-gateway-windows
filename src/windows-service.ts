import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { runPowerShell, psQuote, powershell, windowsProcesses, sameExecutable } from "./windows-platform.js";

export function windowsTaskName(root: string, kind: "worker" | "hub"): string {
  return `Codex-WorkBuddy-${kind}-${crypto.createHash("sha256").update(path.resolve(root).toLowerCase()).digest("hex").slice(0, 12)}`;
}
function validTask(name: string): void {
  if (!/^Codex-WorkBuddy-(worker|hub)-[a-f0-9]{12}$/.test(name)) throw new Error("Invalid gateway scheduled task identity");
}
export function windowsTaskStatus(name: string): { installed: boolean; running: boolean; state?: string } {
  validTask(name);
  return JSON.parse(runPowerShell(`$t=Get-ScheduledTask -TaskName ${psQuote(name)} -ErrorAction SilentlyContinue; if($t) { @{ installed=$true; running=($t.State -eq 'Running'); state=[string]$t.State } | ConvertTo-Json -Compress } else { '{"installed":false,"running":false}' }`));
}
export function uninstallWindowsTask(name: string, managed?: { root: string; nodeBin: string; entry: "hub" | "service"; pidFile: string }): void {
  validTask(name);
  runPowerShell(`$t=Get-ScheduledTask -TaskName ${psQuote(name)} -ErrorAction SilentlyContinue; if($t) { Stop-ScheduledTask -TaskName ${psQuote(name)}; Unregister-ScheduledTask -TaskName ${psQuote(name)} -Confirm:$false }`);
  if (managed) {
    let pid: number | undefined;
    try { pid = JSON.parse(fs.readFileSync(managed.pidFile, "utf8")).pid; } catch { return; }
    if (!Number.isSafeInteger(pid) || !pid || pid <= 0) return;
    const processInfo = windowsProcesses().find(item => item.ProcessId === pid);
    if (!processInfo) return;
    const launcher = path.join(managed.root, "scripts", "launch.mjs").toLowerCase();
    const command = processInfo.CommandLine?.toLowerCase() ?? "";
    if (!sameExecutable(processInfo.ExecutablePath, managed.nodeBin) || !command.includes(launcher) || !command.includes(` ${managed.entry} `)) throw new Error("Service PID identity changed; the unrelated process was not stopped");
    // Task Scheduler may leave a native child after stopping its PowerShell
    // supervisor. Terminate only the gateway process proven by its own PID file.
    runPowerShell(`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($p -and $p.ExecutablePath -eq ${psQuote(processInfo.ExecutablePath!)} -and $p.CommandLine -eq ${psQuote(processInfo.CommandLine!)}) { Stop-Process -Id ${pid} }`);
  }
}
export function installWindowsTask(input: { name: string; root: string; nodeBin: string; entry: "hub" | "service"; args: string[]; logs: string }): void {
  validTask(input.name);
  const dataRoot = path.join(input.root, "data");
  fs.mkdirSync(dataRoot, { recursive: true });
  if (fs.lstatSync(dataRoot).isSymbolicLink()) throw new Error("Service data directory must not be a symbolic link");
  fs.mkdirSync(input.logs, { recursive: true });
  // POSIX modes are not enforced on Windows. Protect this installation's own
  // service state with an inherited current-user DACL instead.
  runPowerShell(`$dir=${psQuote(dataRoot)}; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=Get-Acl -LiteralPath $dir; $acl.SetAccessRuleProtection($true,$false); foreach($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($rule) }; foreach($id in @($sid,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) { $rule=[Security.AccessControl.FileSystemAccessRule]::new($id,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $acl.AddAccessRule($rule) }; Set-Acl -LiteralPath $dir -AclObject $acl`);
  const scriptFile = path.join(input.logs, `${input.name}.ps1`);
  const launch = path.join(input.root, "scripts", "launch.mjs");
  const script = `$ErrorActionPreference='Continue'\r\nSet-Location -LiteralPath ${psQuote(input.root)}\r\nwhile ($true) {\r\n  & ${psQuote(input.nodeBin)} ${[launch, input.entry, ...input.args].map(psQuote).join(" ")} 1>> ${psQuote(path.join(input.logs, "stdout.log"))} 2>> ${psQuote(path.join(input.logs, "stderr.log"))}\r\n  Start-Sleep -Seconds 5\r\n}\r\n`;
  const previous = fs.existsSync(scriptFile) ? fs.readFileSync(scriptFile) : undefined;
  fs.writeFileSync(scriptFile, '\ufeff' + script, "utf8");
  try {
    runPowerShell(`$name=${psQuote(input.name)}; $old=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue; if($old -and $old.State -eq 'Running') { return }; $user=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $action=New-ScheduledTaskAction -Execute ${psQuote(powershell)} -Argument ${psQuote(`-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "${scriptFile}"`)} -WorkingDirectory ${psQuote(input.root)}; $trigger=New-ScheduledTaskTrigger -AtLogOn -User $user; $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited; $settings=New-ScheduledTaskSettingsSet -Hidden -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew; Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Local Codex WorkBuddy gateway; current interactive user only' -Force | Out-Null; Start-ScheduledTask -TaskName $name`, 20000);
  } catch (error) {
    if (previous) fs.writeFileSync(scriptFile, previous); else fs.rmSync(scriptFile, { force: true });
    throw error;
  }
}
