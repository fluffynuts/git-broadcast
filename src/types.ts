import { Logger } from "./console-logger";

export type LogPrefixer = (prefix: string, message: string) => string;

export interface BroadcastOptions {
    in?: string;
    from?: string;
    to?: string[],
    fromRemote?: string;
    toRemote?: string;
    ignoreMissingBranches?: boolean;
    logger?: Logger;
    logPrefixer?: LogPrefixer,
    push?: boolean;
    gitUser?: string;
    gitToken?: string;
    maxErrorLines?: number;
    ignore?: string[]
}

