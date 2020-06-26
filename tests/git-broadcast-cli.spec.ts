import { Sandbox } from "filesystem-sandbox";
import * as faker from "faker";
import { Repository } from "./repository";
import { exec } from "../src/exec";
import * as path from "path";
import * as os from "os";
import { promises as fs } from "fs";

describe(`git-broadcast-cli`, () => {
    it(`should do the expected work with provided args`, async () => {
        jest.setTimeout(10000);
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
            origin = Repository.create(originPath);
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
        expect(log.latest.message)
            .toEqual(updatedMessage);
    });

    async function findTsNode() {
        const
            packageDir = path.dirname(__dirname),
            nodeModulesBin = path.join(packageDir, "node_modules", ".bin"),
            stub = os.platform() === "win32" ? "ts-node.cmd" : "ts-node",
            result = path.join(nodeModulesBin, stub);
        try {
            const st = await fs.stat(result);
            if (!st || !st.isFile()) {
                throw new Error(`ts-node not found at: "${result}"`);
            }
        } catch (e) {
            throw new Error(`ts-node not found at: "${result}"`);
        }
        return result;
    }
});
