import { Sandbox } from "filesystem-sandbox";
import { faker } from "@faker-js/faker";
// @ts-ignore
import { Repository } from "./repository";
import { exec } from "../src/exec";
import * as path from "path";
import * as os from "os";
import { fileExists } from "yafs";
import { configFile } from "../src/is-detached";
import { gitBroadcast, IGNORE_BRANCHES_ENV_VAR } from "../src/git-broadcast";

describe(`git-broadcast-cli`, () => {
  it(`should do the expected work with provided args (integration)`, async () => {
    jest.setTimeout(60000);
    // Arrange
    const
      sandbox = await Sandbox.create(),
      featureBranch = "feature/stuff",
      readmeContents = `initial: ${faker.word.sample()}`,
      updatedContents = `updated: ${faker.word.sample()}`,
      initialMessage = ":tada: initial commit",
      updatedMessage = ":memo: prior docs are all wrong!",
      originPath = await sandbox.mkdir("origin"),
      localPath = await sandbox.mkdir("local"),
      origin = await Repository.createAt(originPath);
    await origin.init();
    await sandbox.writeFile("origin/readme.md", readmeContents);
    await origin.commitAll(initialMessage);
    await sandbox.writeFile("origin/readme.md", updatedContents);
    await origin.commitAll(updatedMessage);
    await origin.checkout("master");

    const local = await Repository.clone(originPath, localPath);
    await local.fetch();
    await local.resetHard("HEAD~1");
    await local.checkout("-b", featureBranch);

    const currentContents = await sandbox.readTextFile("local/readme.md");
    expect(currentContents)
      .toEqual(readmeContents); // should have readme reset

    const tsNodePath = await findTsNode();

    // Act
    await exec(
      tsNodePath, [
        path.resolve(path.join(__dirname, "..", "src", "git-broadcast-cli.ts")),
        "-i", localPath,
        "--from", "master",
        "--to", featureBranch
      ]
    )
    // Assert
    await local.checkout(featureBranch);
    const log = await local.log();
    expect(log.latest?.message)
      .toEqual(updatedMessage);
    const readmeAfterRun = await sandbox.readTextFile("local/readme.md");
    expect(readmeAfterRun)
      .toEqual(updatedContents); // should have readme updated from master
  });

  it(`should do the expected work with provided args`, async () => {
    jest.setTimeout(60000);
    // Arrange
    const
      sandbox = await Sandbox.create(),
      featureBranch = "feature/stuff",
      readmeContents = `initial: ${faker.word.sample()}`,
      updatedContents = `updated: ${faker.word.sample()}`,
      initialMessage = ":tada: initial commit",
      updatedMessage = ":memo: prior docs are all wrong!",
      originPath = await sandbox.mkdir("origin"),
      localPath = await sandbox.mkdir("local"),
      origin = await Repository.createAt(originPath);
    await origin.init();
    await sandbox.writeFile("origin/readme.md", readmeContents);
    await origin.commitAll(initialMessage);
    await sandbox.writeFile("origin/readme.md", updatedContents);
    await origin.commitAll(updatedMessage);
    await origin.checkout("master");

    const local = await Repository.clone(originPath, localPath);
    await local.fetch();
    await local.resetHard("HEAD~1");
    await local.checkout("-b", featureBranch);

    const currentContents = await sandbox.readTextFile("local/readme.md");
    expect(currentContents)
      .toEqual(readmeContents); // should have readme reset

    // Act
    await gitBroadcast({
      in: localPath,
      from: "master",
      to: [ featureBranch ]
    });
    // Assert
    await local.checkout(featureBranch);
    const log = await local.log();
    expect(log.latest?.message)
      .toEqual(updatedMessage);
    const readmeAfterRun = await sandbox.readTextFile("local/readme.md");
    expect(readmeAfterRun)
      .toEqual(updatedContents); // should have readme updated from master
  });

  it(`should ignore a branch configured as detached via ${configFile}`, async () => {
    jest.setTimeout(60000);
    // Arrange
    const
      sandbox = await Sandbox.create(),
      featureBranch = "feature/stuff",
      readmeContents = `initial: ${faker.word.sample()}`,
      updatedContents = `updated: ${faker.word.sample()}`,
      initialMessage = ":tada: initial commit",
      updatedMessage = ":memo: prior docs are all wrong!",
      detachMessage = ":wrench: detach branch from git-broadcast",
      originPath = await sandbox.mkdir("origin"),
      localPath = await sandbox.mkdir("local"),
      origin = await Repository.createAt(originPath),
      config = {
        detached: true // when a satellite is marked as detached, it shouldn't be updated
      };
    await origin.init();
    await sandbox.writeFile("origin/readme.md", readmeContents);
    await origin.commitAll(initialMessage);
    await sandbox.writeFile("origin/readme.md", updatedContents);
    await origin.commitAll(updatedMessage);
    await origin.checkout("master");

    const local = await Repository.clone(originPath, localPath);
    await local.fetch();
    await local.resetHard("HEAD~1");
    await local.checkout("-b", featureBranch);
    const currentContents = await sandbox.readTextFile("local/readme.md");
    expect(currentContents)
      .toEqual(readmeContents); // should have readme reset
    await sandbox.writeFile(
      `local/${configFile}`,
      JSON.stringify(config, null, 2)
    );
    await local.commitAll(detachMessage);

    // Act
    await gitBroadcast({
      in: localPath,
      from: "master",
      to: [ featureBranch ]
    });
    // Assert
    await local.checkout(featureBranch);
    const log = await local.log();
    expect(log.latest?.message)
      .toEqual(detachMessage);
    const readmeAfterDetachedRun = await sandbox.readTextFile("local/readme.md");
    expect(readmeAfterDetachedRun)
      .toEqual(readmeContents); // should NOT have merged in the latest from master
  });

  it(`should ignore a branch found in env var ${IGNORE_BRANCHES_ENV_VAR}`, async () => {
    jest.setTimeout(60000);
    // Arrange
    const
      sandbox = await Sandbox.create(),
      featureBranch = "feature/stuff",
      readmeContents = `initial: ${faker.word.sample()}`,
      updatedContents = `updated: ${faker.word.sample()}`,
      initialMessage = ":tada: initial commit",
      updatedMessage = ":memo: prior docs are all wrong!",
      originPath = await sandbox.mkdir("origin"),
      localPath = await sandbox.mkdir("local"),
      origin = await Repository.createAt(originPath);
    await origin.init();
    await sandbox.writeFile("origin/readme.md", readmeContents);
    await origin.commitAll(initialMessage);
    await sandbox.writeFile("origin/readme.md", updatedContents);
    await origin.commitAll(updatedMessage);
    await origin.checkout("master");

    const local = await Repository.clone(originPath, localPath);
    await local.fetch();
    await local.resetHard("HEAD~1");
    await local.checkout("-b", featureBranch);
    const currentContents = await sandbox.readTextFile("local/readme.md");
    expect(currentContents)
      .toEqual(readmeContents); // should have readme reset

    // Act
    process.env[IGNORE_BRANCHES_ENV_VAR] = [
      faker.word.sample(),
      featureBranch
    ].join(",");
    await gitBroadcast({
      in: localPath,
      from: "master",
      to: [ featureBranch ],
      ignoreMissingBranches: true
    });
    // Assert
    await local.checkout(featureBranch);
    const log = await local.log();
    expect(log.latest?.message)
      .toEqual(initialMessage);
    const readmeAfterDetachedRun = await sandbox.readTextFile("local/readme.md");
    expect(readmeAfterDetachedRun)
      .toEqual(readmeContents); // should NOT have merged in the latest from master
  });

  async function findTsNode() {
    const
      packageDir = path.dirname(__dirname),
      nodeModulesBin = path.join(packageDir, "node_modules", ".bin"),
      stub = os.platform() === "win32" ? "ts-node.cmd" : "ts-node",
      result = path.join(nodeModulesBin, stub);
    if (!await fileExists(result)) {
      throw new Error(`ts-node not found at: "${result}"`);
    }
    return result;
  }
});
