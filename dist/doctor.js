import fs from "node:fs";
import { loadConfig } from "./config.js";
import { WorkBuddyClient } from "./workbuddy-client.js";
import path from "node:path";
import { readServiceRegistration, registeredServiceConfig } from "./persistent-service.js";
import { NativeDesktopRpcTrigger } from "./native-desktop-trigger.js";
// This command intentionally sends no prompt, changes no desktop setting and
// prints no token, cookie, private workspace or session-file path.
const config = loadConfig();
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
const nodeSupported = major > 22 || (major === 22 && minor >= 5);
const macOS = process.platform === "darwin";
const platformSupported = macOS || process.platform === "win32";
const applicationPresent = fs.existsSync(config.cliElectronPath);
const desktopRoute = ["desktop-acp", "desktop-queue"].includes(config.backend);
const checks = { nodeSupported, macOS, platformSupported, applicationPresent, desktopRoute };
const nextSteps = [];
let online = false;
let ready = false;
let connectionStatus = "not_checked";
let persistentServiceConnected = false;
if (!nodeSupported)
    nextSteps.push("Install Node.js 22.5 or later, then build the project again.");
if (!platformSupported)
    nextSteps.push("Desktop setup currently supports macOS and Windows.");
if (!applicationPresent)
    nextSteps.push("Install WorkBuddy or configure WORKBUDDY_CLI_ELECTRON for its local application.");
if (!desktopRoute)
    nextSteps.push("Set WORKBUDDY_BACKEND=desktop-queue in the project .env and restart the MCP server.");
if (nodeSupported && platformSupported && applicationPresent && desktopRoute) {
    try {
        const result = await new WorkBuddyClient({ ...config, requestTimeoutMs: Math.min(config.requestTimeoutMs, 10_000) }).health();
        online = result.online;
        ready = result.ready === true;
        connectionStatus = online ? (ready ? "desktop_ready" : "connectable_unverified_desktop") : "offline";
        if (config.backend === "desktop-queue") {
            const registration = readServiceRegistration(config.serviceConfigFile);
            if (registration && path.resolve(registration.dbFile) === path.resolve(config.dbFile)) {
                const state = JSON.parse(fs.readFileSync(path.join(registration.projectDir, "data", "persistent-service-status.json"), "utf8"));
                const fresh = Date.now() - Date.parse(state.updatedAt) < 30000;
                const trigger = new NativeDesktopRpcTrigger(registeredServiceConfig(config, registration), registration.cdpPort, false);
                try {
                    persistentServiceConnected = fresh && (await trigger.inspect(registration.sessionId)).state !== "offline";
                }
                finally {
                    trigger.close();
                }
                if (persistentServiceConnected)
                    connectionStatus = "persistent_native_connected";
            }
        }
        if (!online && !persistentServiceConnected)
            nextSteps.push(config.backend === "desktop-queue" ? "Inspect service status and the native WorkBuddy connection; a historical session alone does not prove connectivity." : "Keep WorkBuddy logged in and open the intended desktop conversation, then retry this diagnostic.");
        else if (!ready && !persistentServiceConnected)
            nextSteps.push("Verify that the intended interactive session is registered in WorkBuddy desktop before dispatching a task.");
    }
    catch {
        connectionStatus = "probe_failed";
        nextSteps.push("Retry with WorkBuddy running; inspect the local MCP health response for the connection error without sharing credentials.");
    }
}
console.log(JSON.stringify({
    ok: nodeSupported && platformSupported && applicationPresent && desktopRoute && ((online && ready) || persistentServiceConnected),
    backend: config.backend,
    checks,
    online,
    ready,
    persistentServiceConnected,
    connectionStatus,
    taskSent: false,
    videoAcceptance: "pending_user_verification",
    nextSteps,
    note: "A successful health probe only confirms current connectivity, not task execution or video acceptance.",
}, null, 2));
process.exitCode = nodeSupported && platformSupported && applicationPresent && desktopRoute && ((online && ready) || persistentServiceConnected) ? 0 : 1;
//# sourceMappingURL=doctor.js.map