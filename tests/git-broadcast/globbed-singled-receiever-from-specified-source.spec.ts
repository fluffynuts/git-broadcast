import "expect-even-more-jest";
import { Sandbox } from "filesystem-sandbox";
import * as faker from "faker";
import { clearCaches, gitBroadcast } from "../../src/git-broadcast";
import { Repository } from "../repository";

describe(`git-broadcast`, () => {
    beforeEach(() => {
        // we're doing fs-ops here, give things a little more
        // time (though they generally won't need it)
        jest.setTimeout(60000);
        clearCaches();
    });

    afterEach(async () => await Sandbox.destroyAll());

    it(`should broadcast to a globbed single receiver from the specified source`, async () => {
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

        const currentContents = await sandbox.readTextFile("local/readme.md");
        expect(currentContents)
            .toEqual(readmeContents); // should have readme reset
        // Act
        await gitBroadcast({
            in: localPath,
            from: "master",
            to: ["feature/*"]
        })
        // Assert
        await local.checkout(featureBranch);
        const log = await local.log();
        expect(log.latest?.message)
            .toEqual(updatedMessage);
    });
});

