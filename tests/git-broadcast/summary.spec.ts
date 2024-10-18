import { faker } from "@faker-js/faker";
import { BroadcastResult } from "../../src/git-broadcast";
import { createSummary, parseSummary } from "../../src/summary";

describe(`create-summary`, () => {
    it.skip(`should print out the one merged, pushed branch with author info`, async () => {
        // Arrange
        const
            mergedBranch = {
                authorName: faker.person.fullName(),
                authorEmail: faker.internet.email(),
                target: faker.string.alphanumeric(),
                pushed: true
            },
            data = {
                pushedAll: true,
                from: "master",
                to: [],
                ignoreMissingBranches: true,
                unmerged: [],
                merged: [ mergedBranch ]
            } as BroadcastResult;
        // Act
        const result = createSummary(data);
        // Assert
        const parsed = parseSummary(result);
        expect(parsed)
            .toEqual(data);
    });
});
