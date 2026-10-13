import { describe, expect, it } from "vitest";
import { EphemerisError } from "../../src/index.js";

describe("ephemeris > EphemerisError", () => {
	it("carries its code, its class name and its cause", () => {
		const cause = new TypeError("not a string");
		const error = new EphemerisError(
			"E_EPHEMERIS_INVALID_VALUE",
			"name must be a string",
			{ cause },
		);
		expect(error).toBeInstanceOf(Error);
		expect(error.code).toBe("E_EPHEMERIS_INVALID_VALUE");
		expect(error.name).toBe("EphemerisError");
		expect(error.message).toBe("name must be a string");
		expect(error.cause).toBe(cause);
	});

	it("names a subclass after itself", () => {
		class MissingRequired extends EphemerisError {}
		const error = new MissingRequired(
			"E_EPHEMERIS_MISSING_REQUIRED",
			"Product needs a name",
		);
		expect(error.name).toBe("MissingRequired");
		expect(error).toBeInstanceOf(EphemerisError);
	});
});
