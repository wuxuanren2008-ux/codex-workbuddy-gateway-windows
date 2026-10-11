export declare function windowsTaskName(root: string, kind: "worker" | "hub"): string;
export declare function windowsTaskStatus(name: string): {
    installed: boolean;
    running: boolean;
    state?: string;
};
export declare function uninstallWindowsTask(name: string, managed?: {
    root: string;
    nodeBin: string;
    entry: "hub" | "service";
    pidFile: string;
}): void;
export declare function installWindowsTask(input: {
    name: string;
    root: string;
    nodeBin: string;
    entry: "hub" | "service";
    args: string[];
    logs: string;
}): void;
