import { git } from "./git";

const rawBranchResultCache: string[] = [];

export async function listBranchesRaw(
  spec?: string): Promise<string[]> {
  if (rawBranchResultCache.length) {
    return rawBranchResultCache;
  }
  const args = [ "branch", "-a", "--list" ];
  if (spec && spec !== "*") {
    args.push(spec);
  }
  const result = (
    await git.apply(null, args)
  ).stdout;

  rawBranchResultCache.splice(0, 0, ...result);
  return result;
}
export function clearCaches() {
  rawBranchResultCache.splice(0, rawBranchResultCache.length);
}
