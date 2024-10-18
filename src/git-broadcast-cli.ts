#!/usr/bin/env node
import { readVersionInfo } from "./read-version-info";

if (typeof jest !== "undefined") {
    console.error("git-broadcast-cli has been imported into a test!");
    process.exit(1);
}
import * as chalk from "ansi-colors";
import { gitBroadcast } from "./git-broadcast";
import { ConsoleLogger, LogLevel } from "./console-logger";
import { mkdebug } from "./mkdebug";
import { parseArgs } from "./parse-args";
import { createSummary } from "./summary";

const debug = mkdebug(__filename);

(async () => {
    try {
        const args = await parseArgs();
        if (args["show-version"]) {
            console.log(await readVersionInfo());
        }
        args.logger = args.verbose
            ? new ConsoleLogger(LogLevel.debug, args["suppress-log-prefixes"])
            : new ConsoleLogger(LogLevel.info, args["suppress-log-prefixes"]);
        args.logger.logPrefix = args["prefix-logs-with"];
        if (args.pretty) {
            args.logPrefixer = (prefix: string, message: string) => `${prefix} ${message}`;
        }
        debug({
            args
        });
        const
            result = await gitBroadcast(args),
            failedToPush = args.push && result.pushedAll === false,
            mergeFailed = !!result.unmerged.length,
            success = !failedToPush && !mergeFailed;
        if (args["print-summary"]) {
            const summaryLines = createSummary(result)
            summaryLines.forEach(line => console.log(line));
        }
        process.exit(success ? 0 : 2);
    } catch (e) {
        if (e instanceof Error) {
            if (e.stack) {
                e = e.stack;
            } else if (e.message) {
                e = e.message;
            } else {
                e = e.toString();
            }
        }
        console.error(chalk.red(e as string));
        process.exit(1);
    }
})();
