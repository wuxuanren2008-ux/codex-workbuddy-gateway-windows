import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const callerCwd = process.cwd();
const entries = { gateway: 'server.js', doctor: 'doctor.js', worker: 'desktop-worker-cli.js', service: 'service-cli.js', hub: 'platform/cli.js', 'hub-mcp': 'platform/mcp.js' };
const entry = entries[process.argv[2]];
if (!entry) throw new Error('Use gateway, doctor, worker, service, hub or hub-mcp');
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
process.env.AGENT_HUB_CALLER_CWD ??= callerCwd;
process.chdir(root);
const target = path.join(root, 'dist', entry);
process.argv = [process.execPath, target, ...process.argv.slice(3)];
await import(pathToFileURL(target).href);
