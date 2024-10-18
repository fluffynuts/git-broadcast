import { ExecError, ProcessResult } from "./exec";
import { Logger } from "./console-logger";
import { NullLogger } from "./null-logger";
import { mkdebug } from "./mkdebug";
import { makeConstruction, makeFail, makeInfo, makeOk, makeSuccess, makeWarn } from "./prefixers";
import { BroadcastOptions } from "./types";
import { clearCaches, listBranchesRaw } from "./list-branches-raw";
import { currentBranchRe, git } from "./git";
import { matchBranches } from "./match-branches";

const debug = mkdebug(__filename);
export const unknownAuthor: AuthorDetails = {
  name: "Unknown",
  email: "unknown@no-reply.org"
};

const defaultOptions: BroadcastOptions = {
  from: undefined,
  to: [ "*" ],
  ignoreMissingBranches: false,
  fromRemote: "origin",
  toRemote: "origin",
  logPrefixer: dropPrefixAndFormatting,
  maxErrorLines: 10,
  ignore: []
}

type AsyncFunc<T> = (() => Promise<T>);

export function dropPrefixAndFormatting(prefix: string, message: string): string {
  return message.replace(/`/g, "");
}

export interface MergeInfo {
  target: string;
  authorEmail: string;
  authorName: string;
  pushed: boolean;
}

export interface FailedMerge
  extends MergeInfo {
  processResult: ProcessResult
}

export interface MergeAttempt {
  merged?: MergeInfo;
  unmerged?: FailedMerge;
}

export interface BroadcastResult {
  from: string;
  to: string[];
  ignoreMissingBranches: boolean
  merged: MergeInfo[];
  unmerged: FailedMerge[];
  pushedAll?: boolean;
}

export async function gitBroadcast(
  providedOptions: BroadcastOptions
): Promise<BroadcastResult> {
  const opts = {
    ...defaultOptions,
    ...providedOptions
  } as BroadcastOptions;
  const logger = opts.logger ?? new NullLogger();
  return await runIn(opts.in, async () => {
    if (!opts.logPrefixer) {
      opts.logPrefixer = dropPrefixAndFormatting;
    }
    const remotes = await findRemotes();
    if (remotes.length > 1) {
      throw new Error("Multiple remotes are not supported (yet)");
    }
    if (!opts.from) {
      opts.from = await findDefaultBranch();
    }
    let startBranch = await findCurrentBranch();
    if (!startBranch) {
      if (!opts.from) {
        throw new Error(`Cannot determine default branch and no explicit branch set to start from`);
      }
      // can't assume master is the head ref any more
      // -> but can fall back on that as a last resort
      await fetchAll();
      await git("checkout", opts.from);
      startBranch = await findCurrentBranch();
    }
    if (!startBranch) {
      const
        revs = await revParse("HEAD");
      startBranch = revs[0];
      if (!startBranch) {
        logger.warn(`Unable to determine "starting branch"; when this process completes, this repo will not be restored to the original checkout SHA`)
      } else {
        logger.warn(`Unable to determine "starting branch"; when this process completes, this repo will be restored to ${ startBranch }`)
      }
    }

    await fetchAll();

    clearCaches();
    haveFetchedAll = false;

    const result = await tryMergeAll(
      opts,
      remotes,
      logger
    );

    if (startBranch) {
      await gitCheckout(startBranch);
    }
    const ok = makeOk(opts.logPrefixer || dropPrefixAndFormatting);
    logger.debug(ok(`all targets have been visited!`));
    return result;
  });
}

let haveFetchedAll = false;

async function fetchAll() {
  if (haveFetchedAll) {
    return;
  }
  try {
    // try to unshallow first
    await git("fetch", "--unshallow");
    haveFetchedAll = true;
  } catch (e) {
    await git("fetch", "--all");
    haveFetchedAll = true;
  }
}

async function tryMergeAll(
  opts: BroadcastOptions,
  remotes: string[],
  logger: Logger
): Promise<BroadcastResult> {
  const result: BroadcastResult = {
    from: opts.from as string,
    to: opts.to as string[],
    ignoreMissingBranches: opts.ignoreMissingBranches as boolean,
    merged: [] as MergeInfo[],
    unmerged: [] as FailedMerge[],
    pushedAll: undefined
  };
  for (const to of (opts.to || [])) {
    const rawMatches = await matchBranches(to, opts);
    const allTargets = uniq(
      rawMatches
        .filter(b =>
          // match branches already locally checked out
          !b.startsWith("remotes/") ||
          // match branches from the selected target remote
          b.startsWith(`remotes/${ opts.toRemote }`)
        )
        .map(b => stripRemote(b, remotes))
        .filter(b => b !== opts.from)
    );

    debug({
      rawMatches,
      allTargets
    });

    if (allTargets.length === 0) {
      if (opts.ignoreMissingBranches) {
        continue;
      }
      throw new Error(`Can't match branch spec '${ to }'`);
    }
    const
      prefixer = opts.logPrefixer || dropPrefixAndFormatting,
      info = makeInfo(prefixer),
      fail = makeFail(prefixer),
      warn = makeWarn(prefixer),
      success = makeSuccess(prefixer);
    for (const target of allTargets) {
      const mergeAttempt = await tryMerge(logger, target, opts)
      if (!!mergeAttempt.unmerged) {
        logger.debug(info(`adding ${ JSON.stringify(mergeAttempt.unmerged) } to the unmerged collection ):`));
        result.unmerged.push(mergeAttempt.unmerged);
      } else if (!!mergeAttempt.merged) {
        logger.debug(info(`adding ${ mergeAttempt.merged } to the merged collection (:`));
        result.merged.push(mergeAttempt.merged);
        if (opts.push) {
          logger.debug(info(`attempting to push ${ target } to ${ opts.toRemote }`));
          try {
            await git("push", opts.toRemote as string, target);
            mergeAttempt.merged.pushed = true;
            logger.info(success(`\`${ opts.from }\` merged into \`${ target }\` and pushed to \`${ opts.toRemote }\``));
            if (result.pushedAll === undefined) {
              result.pushedAll = true;
            }
          } catch (e) {
            logger.error(fail(`push of ${ target } to ${ opts.toRemote } fails: ${ e }`));
            result.pushedAll = false;
          }
        } else {
          logger.warn(warn(`successful merge of ${
            target
          } will NOT be pushed back to ${
            opts.toRemote
          } (disabled at cli)`));
        }
      }
    }
  }
  result.pushedAll = !!result.pushedAll;
  return result;
}

async function tryMerge(
  logger: Logger,
  target: string,
  opts: BroadcastOptions
): Promise<MergeAttempt> {
  const result = {} as MergeAttempt;
  if (opts.from === undefined) {
    throw new Error(`source for broadcast (--from) not specified\n:all options:\n${ JSON.stringify(opts, null, 2) }`);
  }
  const
    prefixer = opts.logPrefixer || dropPrefixAndFormatting,
    info = makeInfo(prefixer),
    ok = makeOk(prefixer),
    construction = makeConstruction(prefixer),
    success = makeSuccess(prefixer),
    fail = makeFail(prefixer);

  try {
    logger.debug(info(`check out target: ${ target }`));
    await gitCheckout(target);
  } catch (e) {
    logger.error(fail(`cannot check out ${ target }; skipping`));
    // can't check it out; just ignore it? perhaps there's a more
    // deterministic plan, but for now, this will do
    // in particular, this is triggered by git branch --list -a *
    // bringing back the symbolic remotes/origin/HEAD, which isn't something
    // we'd want to merge into anyway
    return result;
  }
  if (!(await findCurrentBranch())) {
    logger.error(fail(`can't find current branch!`));
    return result;
  }
  const fullyQualifiedFrom = `${ opts.fromRemote }/${ opts.from }`;
  if (await branchesAreEquivalent(fullyQualifiedFrom, target)) {
    logger.debug(ok(`${ target } is equivalent to ${ opts.from }`));
    return result;
  }
  const
    authorDetails = await readAuthorDetailsForLatestCommit(),
    authorEmail = authorDetails.email,
    authorName = authorDetails.name;
  try {
    logger.debug(construction(`start merge: ${ fullyQualifiedFrom } -> ${ target }`));
    await gitMerge(fullyQualifiedFrom);
    logger.debug(success(`successfully merged ${ opts.from } -> ${ target }`));
    result.merged = {
      target,
      authorEmail,
      authorName,
      pushed: false
    };
  } catch (e) {
    logger.error(fail(`could not merge \`${ opts.from }\` -> \`${ target }\` (see stderr logging for details)`));
    const err = e as ExecError;
    logError(err);
    await tryDo(async () =>
      await gitAbortMerge()
    );
    result.unmerged = {
      target,
      authorEmail,
      authorName,
      pushed: false,
      processResult: err.result
    };
  }
  return result;
}

function logError(
  e: ExecError
) {
  logLimited(e.result?.stdout);
  logLimited(e.result?.stderr);
  if (e.result !== undefined) {
    return;
  }
  logLimited([ e.message || `${ e }` ]);
}

function logLimited(
  lines: string[] | undefined
) {
  if (lines === undefined) {
    return;
  }
  lines.forEach(line => console.error(line));
}

async function tryDo<T>(asyncAction: () => Promise<T>): Promise<T | void> {
  try {
    return await asyncAction();
  } catch (e) {
    // suppress
  }
}

export interface AuthorDetails {
  name: string;
  email: string;
}

export function parseAuthorDetailsFrom(line: string): AuthorDetails {
  const match = line.match(/Author: (.*) <(.*)>/i);
  if (!match) {
    return unknownAuthor;
  }
  return {
    name: match[1],
    email: match[2]
  };
}

async function readAuthorDetailsForLatestCommit(): Promise<AuthorDetails> {
  const
    processResult = await git("log", "-1");
  return (processResult.stdout || []).reduce(
    (acc, line) => {
      if (line.toLowerCase().startsWith("author:")) {
        return parseAuthorDetailsFrom(line);
      }
      return acc;
    }, unknownAuthor);
}

function stripRemote(
  branchName: string,
  remotes: string[]
): string {
  for (const remote of remotes) {
    const strip = `remotes/${ remote }/`;
    if (branchName.startsWith(strip)) {
      return branchName.substr(strip.length);
    }
  }
  return branchName;
}

function uniq<T>(a: T[]): T[] {
  return Array.from(new Set(a));
}

async function branchesAreEquivalent(
  b1: string,
  b2: string
) {
  const
    shas1 = await revParse(b1),
    shas2 = await revParse(b2);
  // TODO: could print out how far ahead one branch is from another
  return arraysAreEqual(shas1, shas2);
}

async function findRemotes(): Promise<string[]> {
  const
    result = await git("remote", "-v"),
    lines = result.stdout,
    remoteNames = lines.map(l => l.split(/\s/)[0]);
  return uniq(remoteNames);
}

function arraysAreEqual(
  a1: string[],
  a2: string[]) {
  if (a1.length !== a2.length) {
    return false;
  }
  // do this in reverse-order: if there's a mismatch, it's more likely
  // at the tip
  for (let i = a1.length - 1; i > -1; i--) {
    if (a1[i] !== a2[i]) {
      return false;
    }
  }
  return true;
}

async function revParse(branch: string): Promise<string[]> {
  const raw = await git("rev-parse", branch);
  return raw.stdout;
}

function gitCheckout(branch: string): Promise<ProcessResult> {
  return git("checkout", "-f", branch);
}

function gitMerge(branch: string): Promise<ProcessResult> {
  return git("merge", branch);
}

function gitAbortMerge(): Promise<ProcessResult> {
  return git("merge", "--abort");
}

async function runIn<T>(
  dir: string | undefined,
  action: AsyncFunc<T>) {
  const start = process.cwd();
  try {
    if (dir) {
      process.chdir(dir);
    }
    return await action();
  } finally {
    process.chdir(start);
  }
}

async function findCurrentBranch(): Promise<string | undefined> {
  const
    all = await listBranchesRaw(),
    current = all.find(a => a.startsWith("*"));
  const result = current
    ? current.replace(currentBranchRe, "")
    : current;
  if (result?.match(/detached at /)) {
    return undefined; // not on a branch; we're detached!
  }
  return result;
}

async function findDefaultBranch(): Promise<string | undefined> {
  const
    all = await listBranchesRaw(),
    headRef = all.map(b => {
      const match = b.match(/HEAD -> (.*)/);
      return match
        ? match[1]
        : ""
    }).filter(b => !!b)[0]; // should get something like "origin/master"
  if (!headRef) {
    return undefined;
  }
  // we don't want "origin" (or whatever the upstream is called)
  return headRef.split("/").slice(1).join("/");
}

