import "expect-even-more-jest";
import { Sandbox } from "filesystem-sandbox";
// @ts-ignore
import { Repository } from "./repository";
import { matchBranches } from "../src/match-branches";

describe(`match-branch`, () => {
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

});
