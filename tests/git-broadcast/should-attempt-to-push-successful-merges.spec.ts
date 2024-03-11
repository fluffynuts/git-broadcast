// noinspection ES6PreferShortImport

import "expect-even-more-jest";
import { Sandbox } from "filesystem-sandbox";
import { gitBroadcast } from "../../src/git-broadcast";
// @ts-ignore
import { Repository } from "../repository";
import { CollectingLogger } from "../../src/collecting-logger";
import { clearCaches } from "../../src/list-branches-raw";

describe(`git-broadcast`, () => {
    beforeEach(() => {
        // we're doing fs-ops here, give things a little more
        // time (though they generally won't need it)
        jest.setTimeout(60000);
        clearCaches();
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
                    origin = await Repository.createAt(originPath),
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
                expect(log.latest?.message)
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

        describe(`when merge edits branch file without conflict`, () => {
            it(`should push on request`, async () => {
                // Arrange
                const
                    sandbox = await Sandbox.create(),
                    localPath = await sandbox.mkdir("local"),
                    originPath = await sandbox.mkdir("origin"),
                    featureBranch = "feature/stuff",
                    originalContent = [
                        "line 1",
                        "line 2",
                        "line 3",
                    ],
                    updatedContent = [
                        "#line 1",
                        "line 2",
                        "line 3"
                    ],
                    append = "line 4",
                    expected = updatedContent.concat(append),
                    logger = new CollectingLogger(),
                    origin = await Repository.initAt(originPath)
                await sandbox.writeFile("origin/readme.md",
                    originalContent.join("\n")
                );
                await origin.commitAll(":tada: initial commit");

                // local clone, branch, update existing lines
                const local = await Repository.clone(originPath, localPath);
                await local.fetch();
                await local.checkout("master");
                await local.checkout("-b", featureBranch)
                await sandbox.writeFile("local/readme.md",
                    updatedContent.join("\n")
                );
                await local.commitAll(":memo: comment out a line!");

                // upstream changes: appended line
                await sandbox.appendFile(
                    "origin/readme.md",
                    "\nline 4"
                );
                await origin.commitAll(":zap: should merge cleanly");

                // Act
                const result = await gitBroadcast({
                    in: localPath,
                    logger,
                    push: true
                })

                // Assert
                expect(result.unmerged)
                    .toBeEmptyArray();
                await local.checkout(featureBranch);
                const localContents = await sandbox.readTextFile(
                    "local/readme.md"
                );
                expect(localContents.replace(/\r/g, "").split("\n"))
                    .toEqual(expected)
                await origin.checkout(featureBranch);
                const originContents = await sandbox.readTextFile(
                    "origin/readme.md"
                );
                expect(originContents.replace(/\r/g, "").split("\n"))
                    .toEqual(expected);
            });
        });
    });

});
