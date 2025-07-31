import type { Logger } from "./console-logger";
import type { BroadcastOptions, Config } from "./types";
import { heredoc } from "heredoc-ts";
import { fileExists, readTextFile } from "yafs";
import { makeFail, makeWarn } from "./prefixers";
import * as path from "path";

export const configFile = ".git-broadcast";

export async function isDetached(
  branch: string,
  logger: Logger,
  opts: BroadcastOptions
): Promise<boolean> {
  if (await isDetachedByConfigFile(logger, opts)) {
    logger.warn(
      heredoc`
      '${branch}' is detached via config file.
      If this is not intended, remove or update the
      ${configFile} file at the root of the repo
      `);
    return true;
  }
  return false;
}

async function isDetachedByConfigFile(
  logger: Logger,
  opts: BroadcastOptions
): Promise<boolean> {
  const
    prefixer = opts.logPrefixer || dropPrefixAndFormatting,
    warn = makeWarn(prefixer),
    configFilePath = !opts.in
      ? configFile
      : path.join(`${opts.in}`, configFile),
    readResult = await tryReadConfigAt(configFilePath, logger);
  if (!readResult.fileExists) {
    return false; // no config provided
  }
  if (readResult.fileExists && !readResult.fileIsReadable) {
    logger.warn(warn(
        heredoc`
      config file '${configFile}' was found, but is unreadable
      - assuming branch is detached for now (safest option)
      `
      )
    )
  }
  const raw = readResult.fileContents;
  if (raw === undefined || !raw.trim()) {
    // file exists and is either unreadable
    // or empty or not parseable
    // -> safe option is to pretend it's detached
    return true;
  }
  const config = tryParse<Config>(raw, logger, opts);
  if (config === undefined) {
    return true;
  }
  // if the config object can be found, but
  // "detached" isn't set, rather issue a warning
  // and don't do the merge - the author can always
  // fixup the config file and re-commit for a later
  // broadcast
  if (config?.detached === undefined) {
    logger.warn(heredoc`
        detached value not set in ${configFilePath}
        - assuming detached for safety reasons
        - you may update this file with "detached": false
          or remove it completely if not required any more
          if you wish to re-enable git broadcasts to this
          branch
        `);
  }
  return config?.detached ?? true;
}

function tryParse<T>(
  json: string,
  logger: Logger,
  opts: BroadcastOptions
): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    const
      prefixer = opts.logPrefixer || dropPrefixAndFormatting,
      fail = makeFail(prefixer);
    logger.warn(fail(`Unable to parse text as JSON:\n-----\n${json}\n-----`));
    return undefined;
  }
}

interface ReadConfigResult {
  fileExists: boolean;
  fileIsReadable: boolean;
  fileContents?: string;
}

async function tryReadConfigAt(
  filename: string,
  logger: Logger
): Promise<ReadConfigResult> {
  if (!await fileExists(filename)) {
    return {
      fileExists: false,
      fileIsReadable: false
    };
  }
  try {
    const fileContents = await readTextFile(filename);
    return {
      fileExists: true,
      fileIsReadable: true,
      fileContents
    }
  } catch (e: any) {
    logger.error(fail(`Assuming detached repo: unable to read from '${filename}':\n${e}`));
    return {
      fileExists: true,
      fileIsReadable: false
    }
  }
}

export function dropPrefixAndFormatting(prefix: string, message: string): string {
  return message.replace(/`/g, "");
}

