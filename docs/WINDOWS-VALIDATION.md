# Windows validation

The Windows desktop queue adapter was validated with Node 24.19.0 and WorkBuddy 5.7.6. This is a local-machine result, not a promise that every WorkBuddy version or Windows configuration is compatible.

## Automated checks

The TypeScript build and 95 focused regression tests passed. The Windows regression command exercises:

- Loopback port ownership and native executable/ancestor identity.
- Literal arguments and paths containing spaces, Chinese characters and apostrophes.
- Queue claims, lease validation, cancellation and concurrent task-state decisions.
- Durable wake intentions, ambiguous submission handling and same-session rework.
- Per-project workspace registration, Agent Hub HTTP authentication and SDK contracts.

SQLite test fixtures close all connections before removing their directories. POSIX file-mode assertions remain enabled on non-Windows platforms; Windows service state uses an inherited DACL instead.

The upstream full suite also includes Unix socket ACP, legacy shell launchers and ZIP packaging. Those routes are outside this Windows desktop queue validation.

## Live desktop checks

1. Native RPC created a dedicated WorkBuddy session in an isolated test workspace.
2. Real WorkBuddy claimed a task and created a JSON file with a random nonce and exact expected fields. The supervising agent read the real file and checked the values.
3. A second round in the same native session modified the file, retained the nonce and returned a new native attempt. The real artifact and both attempt journals were checked before acceptance.
4. Both gateway services were restarted. Their task records and artifacts were retained, with one Hub process and one wake-service process.
5. WorkBuddy then claimed another task in the original session and correctly read the revised file. Its structured result was independently checked and accepted.

All live rounds reported `runtimeSource: desktop_queue`. Queue acceptance, a heartbeat or a historical session candidate alone was not treated as execution evidence. The supervising agent did not write the delegated test artifact.

Private session IDs, nonces, local usernames, task journals, account configuration and raw application logs are deliberately absent from this repository.

## Limits

- Restarting the gateway services was tested; reboot and logout/login recovery were not.
- Initial setup may require saving work and quitting WorkBuddy from its tray menu before the gateway enables its loopback port. Closing a window may only hide it.
- The adapter never automatically force-kills WorkBuddy. One supervised cleanup of leftover native processes was needed on the validation machine after the user had requested exit; it is not an automatic product behavior.
- Complex long-running tasks, video generation, model quotas and future WorkBuddy versions were not validated.
