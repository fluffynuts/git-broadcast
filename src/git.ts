import { exec, ProcessResult } from "./exec";

export function git(...args: string[]): Promise<ProcessResult> {
  return exec("git", args);
}
export const currentBranchRe = /^\*\s/;
