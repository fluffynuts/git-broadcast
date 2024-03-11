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
      return !isIgnored(line, ignore)
    });
}

function isIgnored(
  line: string,
  ignore: Set<string>
) {
  const parts = line.split("/");
  return ignore.has(line) || ignore.has(parts[parts.length - 1]);
}
