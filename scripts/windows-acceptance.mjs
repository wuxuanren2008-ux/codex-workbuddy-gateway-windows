import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AgentHubClient } from '../dist/platform/client.js';

const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const stateFile = path.join(root, 'data', 'windows-acceptance.json');
const action = process.argv[2] ?? 'status';
const client = AgentHubClient.local();
const save = state => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
const read = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const brief = run => ({ id: run.id, status: run.status, review: run.review, round: run.round, sessionId: run.sessionId, attemptId: run.attemptId, runtimeSource: run.runtimeSource, error: run.error, lastPollError: run.lastPollError, result: run.result });
if (action === 'submit') {
  if (fs.existsSync(stateFile)) throw new Error('Acceptance already reserved; use status/wait without resubmission');
  const workspace = path.join(root, 'work', 'windows-acceptance');
  fs.mkdirSync(workspace, { recursive: true });
  const state = { workspace, nonce: crypto.randomUUID(), idempotencyKey: 'windows-live-' + crypto.randomUUID(), artifact: path.join(workspace, 'gateway-check.json') };
  save(state);
  const response = await client.submit({ provider: 'workbuddy', workspace, output: 'artifacts', idempotencyKey: state.idempotencyKey, timeoutSeconds: 600,
    task: `Windows 网关真实连接验收。请使用你自己的文件工具在 ${state.artifact} 创建 UTF-8 JSON，精确包含 platform="windows", stage="initial", value=7, nonce="${state.nonce}"。读取文件核对；只改本测试目录及平台要求的本轮结果文件。不改桥接器或配置、不写记忆。请按 claim/report 完成真实领取、执行和回报。` });
  save({ ...state, id: response.run.id });
  console.log(JSON.stringify(brief(response.run)));
} else {
  const state = read();
  if (!state.id) throw new Error('Submission has no saved run ID; reconcile the stable key before proceeding');
  let run;
  if (action === 'resume-check') {
    const response = await client.submit({ provider: 'workbuddy', workspace: state.workspace, output: 'json', idempotencyKey: state.idempotencyKey + ':restarted', timeoutSeconds: 300,
      task: `服务重启后的真实派工检查。请用你自己的工具只读 ${state.artifact}，在本轮平台结果文件的 json 字段精确返回 {"stage":"读到的stage","value":读到的value,"checked":读到的checked}。不修改业务文件、不改网关配置。读取失败如实 blocked。` });
    save({ ...state, restartId: response.run.id }); run = response.run;
  } else if (action === 'resume-wait') run = await client.wait(state.restartId, { timeoutMs: 45000 });
  else if (action === 'resume-accept') {
    run = await client.get(state.restartId);
    if (run.status !== 'completed' || run.runtimeSource !== 'desktop_queue' || run.result?.json?.stage !== 'revised' || run.result?.json?.value !== 11 || run.result?.json?.checked !== true) throw new Error('Restarted services did not produce the expected native read result');
    run = await client.accept(run.id, 'Gateway services restarted and retained working native dispatch', ['WorkBuddy read the existing artifact through native desktop_queue after both gateway services were restarted.', 'Structured result exactly matches the independently verified file: revised, 11, checked true.']);
  } else if (action === 'wait') run = await client.wait(state.id, { timeoutMs: 45000 });
  else if (action === 'rework') {
    const initial = JSON.parse(fs.readFileSync(state.artifact, 'utf8'));
    if (initial.nonce !== state.nonce || initial.value !== 7 || initial.stage !== 'initial' || initial.platform !== 'windows') throw new Error('Initial artifact content failed verification');
    const response = await client.rework(state.id, `请在同一真实会话修改 ${state.artifact}，保留 platform 和 nonce，改 stage="revised", value=11，并增加 checked=true。读取文件自检后生成本轮平台结果文件并 report。只改原授权范围。`);
    run = response.run ?? response;
  } else if (action === 'accept') {
    const result = JSON.parse(fs.readFileSync(state.artifact, 'utf8'));
    run = await client.get(state.id);
    if (run.status !== 'completed' || run.runtimeSource !== 'desktop_queue' || result.nonce !== state.nonce || result.value !== 11 || result.stage !== 'revised' || result.checked !== true || result.platform !== 'windows') throw new Error('Revised artifact or execution provenance failed verification');
    const runsDir = path.join(root, 'data', 'runs');
    const attempts = fs.readdirSync(runsDir).filter(name => /^run-[a-f0-9-]{36}$/.test(name)).map(name => JSON.parse(fs.readFileSync(path.join(runsDir, name, 'state.json'), 'utf8'))).filter(item => item.taskId === run.providerTaskId);
    if (attempts.length !== 2 || attempts.some(item => item.sessionId !== run.sessionId || item.runtimeSource !== 'desktop_queue')) throw new Error('Both rounds must preserve the original native session and provenance');
    const response = await client.accept(state.id, 'Windows native creation and same-session revision verified against real artifact', [`Read ${state.artifact}; exact nonce, platform windows, revised stage, value 11 and checked true match.`, `Read two native attempt journals; both use desktop_queue and session ${run.sessionId}.`]);
    run = response.run ?? response;
  } else run = await client.get(state.id);
  console.log(JSON.stringify(brief(run)));
}
