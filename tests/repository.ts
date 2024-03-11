import { CommitSummary, LogOptions, SimpleGit, StatusResult } from "simple-git";
import * as path from "path";
import GitFactory from "simple-git";
import { folderExistsSync } from "yafs";

export class Repository {
  public get fullpath() {
    return this._fullpath;
  }

  private get git(): SimpleGit {
    if (!this._git) {
      this._git = GitFactory(this._fullpath)
    }
    return this._git as SimpleGit;
  }

  private _git: SimpleGit | undefined;

  constructor(private _fullpath: string) {
  }

  public async init(): Promise<void> {
    await this.git.init(false);
  }

  public checkout(...args: string[]) {
    return this.git.checkout(args);
  }

  public reset(...args: string[]) {
    return this.git.reset(args);
  }

  public resetHard(where: string) {
    return this.reset("--hard", where);
  }

  public async createBranch(
    name: string,
    andCheckOut: boolean = true
  ): Promise<void> {
    await this.git.branch([ name ]);
    if (andCheckOut) {
      await this.git.checkout([ name ]);
    }
  }

  public status(): Promise<StatusResult> {
    return this.git.status();
  }

  public log(options?: LogOptions) {
    return this.git.log(options);
  }

  public fetch() {
    return this.git.fetch();
  }

  public async addAll(): Promise<void> {
    const status = await this.git.status();
    for (const f of status.files) {
      await this.git.add(f.path);
    }
  }

  public async commitAll(message: string): Promise<CommitSummary> {
    await this.addAll();
    return this.commit(message);
  }

  public commit(message: string): Promise<CommitSummary> {
    return this.git.commit(message);
  }

  public static async clone(
    srcPath: string,
    targetPath: string): Promise<Repository> {
    const git = GitFactory(".");
    await git.clone(srcPath, targetPath);
    return new Repository(targetPath);
  }

  public static async createAt(at: string): Promise<Repository> {
    const
      target = path.resolve(at),
      search = path.join(target, ".git");
    if (!folderExistsSync(search)) {
      const git = GitFactory(target);
      await git.init();
    }

    return new Repository(path.resolve(at));
  }

  public static async initAt(at: string): Promise<Repository> {
    const result = new Repository(path.resolve(at));
    await result.init();
    return result;
  }
}
