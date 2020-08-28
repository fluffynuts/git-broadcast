import "expect-even-more-jest";
import { Sandbox } from "filesystem-sandbox";
import { gitBroadcast } from "../../src/git-broadcast";
import { Repository } from "../repository";
import { CollectingLogger } from "../../src/collecting-logger";

describe(`git-broadcast`, () => {
    beforeEach(() => {
        // we're doing fs-ops here, give things a little more
        // time (though they generally won't need it)
        jest.setTimeout(60000);
    });

    afterEach(async () => await Sandbox.destroyAll());

    describe(`when one branch successfully merged`, () => {
        describe(`merge contains no edits to branch`, () => {
            it(`should push on request`, async () => {
                // Arrange
                const
                    sandbox = await Sandbox.create(),
                    originPath = await sandbox.mkdir("origin"),
                    localPath = await sandbox.mkdir("local"),
                    origin = Repository.createAt(originPath),
                    featureBranch = "feature/add-package-json",
                    logger = new CollectingLogger();
                await origin.init();
                await sandbox.writeFile("origin/readme.md", "initial commit");
                await origin.commitAll(":tada: initial commit");
                await sandbox.writeFile("origin/readme.md", "secondary commit");
                await origin.commitAll(":memo: update readme");

                // required so that local clone works as expected
                await origin.checkout("master");

                const local = await Repository.clone(originPath, localPath);
                await local.fetch();
                await local.checkout("master");
                await local.resetHard("HEAD~1");
                await local.checkout("-b", featureBranch);
                await sandbox.writeFile("local/package.json", "{}");
                await local.commitAll(":sparkles: add empty package.json");
                // Act
                const result = await gitBroadcast({
                    in: localPath,
                    logger,
                    push: true
                });
                // Assert
                expect(result.unmerged)
                    .toBeEmptyArray();

                await local.checkout(featureBranch);
                const log = await local.log();
                // messages should reflect a fast-forward merge
                expect(log.latest.message)
                    .toMatch(/Merge remote-tracking/);
                expect(log.all[1].message)
                    .toEqual(":sparkles: add empty package.json");
                expect(log.all[2].message)
                    .toEqual(":memo: update readme");
                const readmeContents = await sandbox.readTextFile("local/readme.md");
                expect(readmeContents)
                    .toEqual("secondary commit");

                await origin.checkout(featureBranch);
                expect(sandbox.fullPathFor("origin/package.json"))
                    .toBeFile();
            });
        });

        describe.skip(`WIP: when merge edits branch file`, () => {
            it(`should push on request`, async () => {
                // Arrange
                const
                    sandbox = await Sandbox.create(),
                    localPath = await sandbox.mkdir("local"),
                    originPath = await sandbox.mkdir("origin"),
                    branch = "feature/stuff",
                    origin = await Repository.initAt(originPath)
                await sandbox.writeFile("origin/readme.md",
                    [ "line 1", "line 2", "line 3" ].join("\n")
                );
                await origin.commitAll(":tada: initial commit");
                await sandbox.appendFile(
                    "origin/readme.md",
                    "line4"
                );
                // Act
                // Assert
            });
        });
    });

});
