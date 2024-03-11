import yargs from "yargs";
import { BroadcastOptions } from "./types";
import { readVersionInfo } from "./read-version-info";

export interface CliOptions
  extends BroadcastOptions {
  verbose: boolean;
  "print-summary": boolean;
  "pretty": boolean;
  "show-version": boolean;
  "suppress-log-prefixes": boolean;
  "prefix-logs-with": string;
  "ignore": string[]
}

export async function parseArgs(): Promise<CliOptions> {
  return yargs
    .option("from", {
      type: "string",
      alias: "f",
      description: "source branch which is to be merged into recipients",
      default: undefined,
      demandOption: false
    })
    .option("to", {
      type: "string",
      alias: "t",
      default: "*",
      description: "branch, branches or glob (eg feature/*) which will have the source branch merged in"
    })
    .array("to")
    .option("ignore-missing-branches", {
      type: "boolean",
      default: false,
      description: "when set finding no matches for a particular 'to' glob will not cause an error to be raised"
    })
    .option("in", {
      type: "string",
      alias: "i",
      description: "run in the specified folder instead of the current working directory"
    })
    .option("verbose", {
      type: "boolean",
      alias: "v",
      description: "output more logging info",
      default: false
    })
    .option("push", {
      type: "boolean",
      alias: "p",
      description: "push successfully-merged branches",
      default: true
    }).option("git-user", {
      type: "string",
      description: "username to use when attempting to push commits"
    }).option("git-token", {
      type: "string",
      description: "token to use as password when pushing commits"
    }).option("push", {
      type: "boolean",
      default: false,
      description: "attempt to push successfully-merged branches when complete (may require git-user and git-token)"
    }).option("print-summary", {
      type: "boolean",
      default: false,
      description: "print out a summary of operations at the end - useful for piping into another process, eg a notifier"
    }).option("pretty", {
      type: "boolean",
      default: false,
      description: "enable emoji and other formatting like back-ticks - nice if you're forwarding on to somewhere to display, eg slack"
    }).option("show-version", {
      type: "boolean",
      default: true,
      description: "show the version of git-broadcast during normal operations"
    }).option("suppress-log-prefixes", {
      type: "boolean",
      default: false,
      description: "suppress log prefixes (timestamp and log level) in logging for cleaner output, eg when redirecting to slack"
    }).option("prefix-logs-with", {
      type: "string",
      default: "",
      description: "prefix all logging with this string (eg your repo name, to clarify interleaved log collection)"
    }).option("ignore", {
      type: "array",
      default: [],
      description: "a list of branch names to ignore"
    })
    .version(await readVersionInfo())
    .help()
    .argv;
}
