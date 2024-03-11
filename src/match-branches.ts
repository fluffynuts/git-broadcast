import { BroadcastOptions } from "./types";
import { listBranchesRaw } from "./list-branches-raw";
import { currentBranchRe } from "./git";

export async function matchBranches(
  spec: string,
  opts: BroadcastOptions
): Promise<string[]> {
  const
    ignore = new Set<string>(opts.ignore || []),
    result = await listBranchesRaw(spec);
  return result.map(
    // remove the "current branch" marker
    line => line.replace(currentBranchRe, "")
  ).map(line => line.trim())
    .filter(line => line.indexOf(" -> ") === -1)
    .filter(line => {
      return !ignore.has((line || "").trim())
    });
}
