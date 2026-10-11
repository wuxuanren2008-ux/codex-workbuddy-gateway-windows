export declare function psQuote(value: string): string;
export declare const powershell: string;
export declare function runPowerShell(script: string, timeout?: number): string;
export interface WindowsProcess {
    ProcessId: number;
    ParentProcessId: number;
    ExecutablePath: string | null;
    CommandLine: string | null;
}
export declare function windowsProcesses(): WindowsProcess[];
export declare function sameExecutable(a: string | null, b: string): boolean;
export declare function nativeRoot(process: WindowsProcess, executable: string): boolean;
export declare function nativeAncestor(processes: WindowsProcess[], parentPid: number, executable: string): number | undefined;
export interface PortOwner {
    LocalAddress: string;
    OwningProcess: number;
    ExecutablePath: string | null;
    CommandLine: string | null;
}
export declare function windowsPortOwners(port: number): PortOwner[];
export declare function classifyWindowsPort(owners: PortOwner[], executable: string): "absent" | "native" | "foreign";
