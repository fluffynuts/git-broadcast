import { ConsoleLogger, LogLevel } from "../src/console-logger";

describe(`console-logger`, () => {
    it(`should default to log level info`, async () => {
        // Arrange
        const sut = create();
        // Act
        const result = sut.level;
        // Assert
        expect(result)
            .toEqual(LogLevel.info);
    });

    it(`should log info via console.log`, async () => {
        // Arrange
        spyOn(console, "log");
        const sut = create();
        // Act
        sut.info("foo bar");
        // Assert
        expect(console.log)
            .toHaveBeenCalledWith(
                jasmine.stringMatching(/foo bar/)
            );
    });

    function create(level?: LogLevel) {
        return new ConsoleLogger(level);
    }
});
