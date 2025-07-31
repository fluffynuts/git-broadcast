import "expect-even-more-jest";
import { Sandbox } from "filesystem-sandbox";
import type { BroadcastOptions, Config } from "../src";
import { NullLogger } from "../src/null-logger";
import { isDetached } from "../src/is-detached";
import { faker } from "@faker-js/faker";
import { heredoc } from "heredoc-ts";

describe(`is-detached`, () => {
  const { spyOn } = jest;

  describe(`default behavior`, () => {
    it(`should return false`, async () => {
      // Arrange
      const
        options = {} as BroadcastOptions,
        branch = `feat/${faker.word.sample()}`,
        logger = createLogger(),
        sandbox = await Sandbox.create();
      // Act
      const result = await sandbox.run(
        async () => await isDetached(branch, logger, options)
      );
      // Assert
      expect(result)
        .toBeFalse();
    });
  });

  describe(`when config file exists`, () => {
    describe(`and is empty`, () => {
      // this is a safety concern: if the file
      // exists, but is empty or cannot be read,
      // rather assume detachment and avoid
      // an unwanted merge
      it(`should return true`, async () => {
        // Arrange
        const
          options = {} as BroadcastOptions,
          branch = `feat/${faker.word.sample()}`,
          logger = createLogger(),
          sandbox = await Sandbox.create();
        await sandbox.writeFile(".git-broadcast", "");
        // Act
        const result = await sandbox.run(
          async () => await isDetached(branch, logger, options)
        );
        // Assert
        expect(result)
          .toBeTrue();
      });
    });

    describe(`and is not valid json`, () => {
      // this is a safety concern: if the file
      // exists, but is empty or cannot be read,
      // rather assume detachment and avoid
      // an unwanted merge
      it(`should return true`, async () => {
        // Arrange
        const
          options = {} as BroadcastOptions,
          branch = `feat/${faker.word.sample()}`,
          logger = createLogger(),
          sandbox = await Sandbox.create();
        await sandbox.writeFile(".git-broadcast", heredoc`
        this is most definitely not json
        `);
        // Act
        const result = await sandbox.run(
          async () => await isDetached(branch, logger, options)
        );
        // Assert
        expect(result)
          .toBeTrue();
      });
    });

    describe(`and has no "detached" value set`, () => {
      it(`should return true`, async () => {
        // this is a safety concern: if the file
        // exists, and the detached field is
        // missing, rather err on the side of
        // caution and issue a warning
        const
          options = {} as BroadcastOptions,
          branch = `feat/${faker.word.sample()}`,
          logger = createLogger(),
          sandbox = await Sandbox.create();
        await sandbox.writeFile(".git-broadcast", heredoc`
        {}
        `);
        // Act
        const result = await sandbox.run(
          async () => await isDetached(branch, logger, options)
        );
        // Assert
        expect(result)
          .toBeTrue();
        expect(logger.warn)
          .toHaveBeenCalledOnceWith(
            expect.stringContaining(
              "detached value not set"
            )
          );
      });
    });

    describe(`and is configured with '"detached": true'`, () => {
      it(`should return true`, async () => {
        // Arrange
        const
          options = {} as BroadcastOptions,
          branch = `feat/${faker.word.sample()}`,
          logger = createLogger(),
          config: Config = {
            detached: true
          },
          sandbox = await Sandbox.create();
        await sandbox.writeFile(".git-broadcast", JSON.stringify(config));
        // Act
        const result = await sandbox.run(
          async () => await isDetached(branch, logger, options)
        );
        // Assert
        expect(result)
          .toBeTrue();
      });
    });

    describe(`and is configured with '"detached": false'`, () => {
      it(`should return false`, async () => {
        // Arrange
        const
          options = {} as BroadcastOptions,
          branch = `feat/${faker.word.sample()}`,
          logger = createLogger(),
          config: Config = {
            detached: false
          },
          sandbox = await Sandbox.create();
        await sandbox.writeFile(".git-broadcast", JSON.stringify(config));
        // Act
        const result = await sandbox.run(
          async () => await isDetached(branch, logger, options)
        );
        // Assert
        expect(result)
          .toBeFalse();
      });
    });
  });

  function createLogger() {
    const result = new NullLogger();
    spyOn(result, "debug");
    spyOn(result, "error");
    spyOn(result, "info");
    spyOn(result, "warn");
    return result;
  }
});
