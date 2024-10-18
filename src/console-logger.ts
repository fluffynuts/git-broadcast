import * as chalk from "ansi-colors";

export type LogFunction = (...args: any[]) => void;
type PassThrough<T> = (o: T) => T;

export interface Logger {
    logPrefix: string;
    info: LogFunction;
    warn: LogFunction;
    error: LogFunction;
    debug: LogFunction;
}

export enum LogLevel {
    debug = 0,
    info = 1,
    warn = 2,
    error = 3
}

function noop() {
    // intentionally left blank
}

function zpad(s: string | number, digits: number = 2) {
    s = (s || "").toString();
    while (s.length < digits) {
        s = `0${ s }`
    }
    return s;
}

function timestamp() {
    const
        now = new Date(),
        y = zpad(now.getFullYear()),
        m = zpad(now.getMonth() + 1),
        d = zpad(now.getDate()),
        H = zpad(now.getHours()),
        M = zpad(now.getMinutes()),
        S = zpad(now.getSeconds());
    return `${ y }-${ m }-${ d } ${ H }:${ M }:${ S }`;
}

function yellow(s: string): string {
  return chalk.yellowBright(s);
}
function red(s: string): string {
  return chalk.redBright(s);
}
function magenta(s: string): string {
  return chalk.magentaBright(s);
}
function gray(s: string): string {
  return chalk.gray(s);
}

export class ConsoleLogger implements Logger {

    public get error() {
        return this._error;
    }

    public get warn() {
        return this._warn;
    }

    public get info() {
        return this._info;
    }

    public get debug() {
        return this._debug;
    }

    public get level() {
        return this._level;
    }

    public logPrefix: string = "";

    private readonly _error: LogFunction;
    private readonly _warn: LogFunction;
    private readonly _info: LogFunction;
    private readonly _debug: LogFunction;

    private readonly _level: LogLevel;

    constructor(
        level?: LogLevel,
        suppressLogPrefixes?: boolean
    ) {
        if (level === undefined) {
            level = LogLevel.info;
        }
        if (suppressLogPrefixes === undefined) {
            suppressLogPrefixes = false;
        }

        this._level = level;

        this._debug = level > LogLevel.debug
            ? noop
            : this._makeLogger(console.debug.bind(console), gray, "DEBUG", suppressLogPrefixes);
        this._info = level > LogLevel.info
            ? noop
            : this._makeLogger(console.log.bind(console), yellow, "INFO", suppressLogPrefixes);
        this._warn = level > LogLevel.warn
            ? noop
            : this._makeLogger(console.log.bind(console), magenta, "WARN", suppressLogPrefixes);
        // if we bind to console.error, then the consumer has to redirect stderr to catch error
        // messages in a piped application (eg slack-webhook-say)
        this._error = this._makeLogger(console.log.bind(console), red, "ERROR", suppressLogPrefixes)
    }

    private _makeLogger(
        logger: LogFunction,
        colorizer: PassThrough<string>,
        prefix: string,
        suppressTimestamps: boolean
    ): LogFunction {
        const generateTimestampAndLevelPrefix = suppressTimestamps
            ? () => ""
            : () => `[ ${ prefix } :: ${ timestamp() } ]`
        const customPrefix = () => !!(this.logPrefix || "").trim()
            ? `${ this.logPrefix } `
            : "";
        return (...args: any[]) => {
            const
                stampedPre = generateTimestampAndLevelPrefix(),
                customPre = customPrefix(),
                pre = `${ customPre }${ stampedPre }`;
            if (typeof args[0] === "string") {
                args[0] = `${ pre } ${ args[0] }`;
            } else {
                args = [ pre ].concat(args);
            }
            logger(
                ...args.map(a => colorizer(a))
            );
        }
    }
}


export function stringify(...args: any[]) {
    return args.map(a => {
        return typeof a === "string"
            ? a
            : JSON.stringify(a)
    }).join(" ");
}
