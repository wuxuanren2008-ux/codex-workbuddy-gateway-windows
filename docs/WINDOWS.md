# Windows desktop adapter

This Windows adaptation retains the upstream macOS route. Windows uses native WorkBuddyAI.exe, the user's `.workbuddy-ai/workbuddy.db`, Node entry points and current-user interactive scheduled tasks. It does not use an independent CLI model or read account credentials.

## Commands

Clone this fork and run `npm ci` and `npm run build` first. Copy `.env.example` to `.env` only if `.env` does not already exist. Keep `WORKBUDDY_BACKEND=desktop-queue`; existing configuration and task state must be preserved. The old upstream ZIP downloads do not include this Windows adapter.

From the project directory in PowerShell:

```powershell
node scripts/launch.mjs hub install
node scripts/launch.mjs hub status
node scripts/launch.mjs doctor
node scripts/launch.mjs service status
```

`scripts/launch.mjs` loads this project's `.env` and preserves literal arguments. In a host's stdio MCP registration, use the absolute Node executable as `command` and the absolute launcher path followed by `hub-mcp` (Agent Hub) or `gateway` (direct WorkBuddy) as `args`.

For Codex CLI in PowerShell, replace the project path with the actual checkout:

```powershell
$nodeBin = (Get-Command node).Source
codex mcp add agent-hub-windows -- $nodeBin 'C:\path\to\gateway\scripts\launch.mjs' hub-mcp
codex mcp add workbuddy-windows -- $nodeBin 'C:\path\to\gateway\scripts\launch.mjs' gateway
```

Install the Skill from the complete project with `npm run skill:install`. It becomes available in the next Codex conversation. New tasks should use `workbuddy-executor` and specify the actual business workspace.

WorkBuddy executable and history paths can be overridden using `WORKBUDDY_CLI_ELECTRON` and `WORKBUDDY_CONFIG_DIR`. Local configuration and task state must not be published. Node must be >=22.13.0.

## First desktop connection

When WorkBuddy is already running without its loopback CDP port, save your work and quit it once using its tray menu. Closing its window may only minimize it. The gateway then starts the native application with a loopback debugging port; it refuses foreign or publicly bound listeners. It does not force-kill a running desktop process.

Native workspace creation and queue submission preserve reserved session IDs and stable task IDs. Failed or uncertain creation must be inspected before retrying. A queued task is not proof of execution. A completed task still requires checking actual artifacts and recording acceptance.

## Services

Agent Hub and the WorkBuddy wake service have separate scheduled tasks named `Codex-WorkBuddy-hub-<installation hash>` and `Codex-WorkBuddy-worker-<installation hash>`. They run only for the current logged-in interactive user, with limited privileges and hidden PowerShell supervisor windows. The supervisors restart failed gateway processes after five seconds. No tasks means no model requests.

Windows `chmod` is not a privacy boundary. Service state directories are protected with a current-user, Administrators and SYSTEM inherited DACL. Queue file durability flushes a writable file handle; Windows directory handles cannot be fsynced through Node.

```powershell
node scripts/launch.mjs hub uninstall
node scripts/launch.mjs service uninstall
```

Uninstall retains task history and artifacts. Logged-out or powered-off computers cannot execute tasks. Logon recovery and reboot behavior require separate live testing; scheduled registration alone does not prove those scenarios.

## Validation

Build: `npm ci` followed by `npm run build`. Run the Windows desktop regression suite with `npm run test:windows`. The upstream full suite also covers Unix-only legacy routes and packaging tools.

The focused regression suite covers port ownership, process ancestry, literal Windows paths, launcher env/cwd, native queue identity, same-session revisions, ambiguous submissions, cancellation, workspace routing and Agent Hub contracts. See `WINDOWS-VALIDATION.md` for the tested scope. End-to-end evidence is retained privately on the validation machine; a heartbeat or historical session candidate is insufficient.
