import { Exception } from "@c9up/flare";
import { describe, expect, it } from "vitest";
import { errors } from "../../src/index.js";

describe("ephemeris > errors", () => {
	it("exports one class per code, each a flare Exception carrying its cause", () => {
		const cause = new TypeError("not a string");
		const error = new errors.E_EPHEMERIS_INVALID_VALUE(
			["name", "must be a string"],
			{ cause },
		);
		expect(error).toBeInstanceOf(Exception);
		expect(error.code).toBe("E_EPHEMERIS_INVALID_VALUE");
		expect(error.status).toBe(500);
		expect(error.message).toBe("name must be a string");
		expect(error.cause).toBe(cause);
	});

	it("keeps what a missing required property names", () => {
		const error = new errors.E_EPHEMERIS_MISSING_REQUIRED(
			"Product",
			"name",
			"https://developers.google.com/search/docs/appearance/structured-data/product",
		);
		expect(error).toBeInstanceOf(Exception);
		expect(error).toMatchObject({
			code: "E_EPHEMERIS_MISSING_REQUIRED",
			name: "E_EPHEMERIS_MISSING_REQUIRED",
			type: "Product",
			property: "name",
		});
		expect(error.message).toMatch(/^Product needs name — https:/);
	});
});
