import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CURRENCIES } from "../../src/currencies.js";

const file = fileURLToPath(
	new URL("../../vocabulary/iso4217-list-one-2026-09-17.xml", import.meta.url),
);

describe("ephemeris > ISO 4217", () => {
	it("is the maintenance agency's list, without XTS and XXX", () => {
		const xml = readFileSync(file, "utf8");
		const listed = new Set(
			[...xml.matchAll(/<Ccy>([A-Z]{3})<\/Ccy>/g)].map(
				([, code]) => code ?? "",
			),
		);
		listed.delete("XTS");
		listed.delete("XXX");
		expect([...CURRENCIES].sort()).toEqual([...listed].sort());
		expect(CURRENCIES.size).toBe(176);
		expect(CURRENCIES.has("CHF")).toBe(true);
	});
});
