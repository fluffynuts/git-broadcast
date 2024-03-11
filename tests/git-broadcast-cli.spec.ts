import { Sandbox } from "filesystem-sandbox";
import * as faker from "faker";
// @ts-ignore
import { Repository } from "./repository";
import { exec } from "../src/exec";
import { matchBranches } from "../src/match-branches";
import * as path from "path";
import * as os from "os";
import { fileExists } from "yafs";

describe(`git-broadcast-cli`, () => {
  it(`should do the expected work with provided args`, async () => {
    jest.setTimeout(60000);
    // Arrange
    const
      sandbox = await Sandbox.create(),
      featureBranch = "feature/stuff",
      readmeContents = `initial: ${ faker.random.words() }`,
      updatedContents = `updated: ${ faker.random.words() }`,
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
  });

  it(`should ignore ignored branches`, async () => {
    // Arrange
    const
      sandbox = await Sandbox.create(),
      repo = await Repository.createAt(sandbox.path);
    // Act
    await sandbox.writeFile("readme.md", "initial commit - master");
    await repo.commitAll(":tada: initial commit - master");
    await repo.createBranch("satellite1");
    await sandbox.writeFile("satellite1-artifact.txt", "moo");
    await repo.commitAll(":alembic: add an artifact");
    await repo.checkout("master");
    await repo.createBranch("satellite2");
    await sandbox.writeFile("satellite2-artifact.txt", "cow");

    const result = await sandbox.run(async () =>
      await matchBranches("*", { ignore: [ "satellite2" ] })
    );

    // Assert
    expect(result)
      .not.toContain("satellite2");
  });

  async function findTsNode() {
    const
      packageDir = path.dirname(__dirname),
      nodeModulesBin = path.join(packageDir, "node_modules", ".bin"),
      stub = os.platform() === "win32" ? "ts-node.cmd" : "ts-node",
      result = path.join(nodeModulesBin, stub);
    if (!await fileExists(result)) {
      throw new Error(`ts-node not found at: "${ result }"`);
    }
    return result;
  }
});
