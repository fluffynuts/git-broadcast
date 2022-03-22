import "expect-even-more-jest";
import { Sandbox } from "filesystem-sandbox";
import * as faker from "faker";
import { clearCaches, gitBroadcast } from "../../src/git-broadcast";
import { Repository } from "../repository";
import { CollectingLogger } from "../../src/collecting-logger";

describe(`git-broadcast`, () => {
    beforeEach(() => {
        // we're doing fs-ops here, give things a little more
        // time (though they generally won't need it)
        jest.setTimeout(60000);
        clearCaches();
    });

    afterEach(async () => await Sandbox.destroyAll());

    describe(`when merge fails`, () => {
        it(`should report failures`, async () => {
            // Arrange
            const
                sandbox = await Sandbox.create(),
                featureBranch = "feature/stuff",
                readmeContents = `initial: ${ faker.random.words() }`,
                updatedContents = `updated: ${ faker.random.words() }`,
                conflictingContents = `conflict: ${faker.random.words() }`,
                initialMessage = ":tada: initial commit",
                updatedMessage = ":memo: prior docs are all wrong!",
                conflictingMessage = ":fire: conflict!",
                originPath = await sandbox.mkdir("origin"),
                localPath = await sandbox.mkdir("local"),
                origin = Repository.createAt(originPath);
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
            await sandbox.writeFile("local/readme.md", conflictingContents);
            await local.commitAll(conflictingMessage);
            const beforeLog = await local.log();
            expect(beforeLog.latest?.message)
                .toEqual(conflictingMessage);

            const currentContents = await sandbox.readTextFile("local/readme.md");
            expect(currentContents)
                .toEqual(conflictingContents); // should have readme updated
            const logger = new CollectingLogger();
            // Act
            const result = await gitBroadcast({
                in: localPath,
                logger
            })
            // Assert
            await local.checkout(featureBranch);
            const log = await local.log();
            expect(log.latest?.message)
                .toEqual(conflictingMessage);
            expect(result.unmerged)
                .toBeArray();
            expect(result.unmerged)
                .toHaveLength(1);
            expect(result.unmerged)
                .toContainElementLike({ target: featureBranch });

        });
    });

});
