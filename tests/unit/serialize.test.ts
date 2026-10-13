import { describe, expect, it } from "vitest";
import {
	EphemerisError,
	jsonLdScriptTag,
	stringifyJsonLd,
	toJsonLd,
} from "../../src/index.js";

function refusal(build: () => unknown): EphemerisError {
	try {
		build();
	} catch (error) {
		if (error instanceof EphemerisError) return error;
		throw error;
	}
	throw new Error("expected a refusal");
}

const HOSTILE = {
	"@context": "https://schema.org",
	"@type": "Product",
	name: "</script><script>alert(1)</script>",
	description: "</SCRIPT >and <!--<script> and ]]> & \u2028\u2029",
	review: [{ "@type": "Review", reviewBody: "<img src=x onerror=alert(2)>" }],
	offers: {
		"@type": "Offer",
		price: 119.95,
		availability: "InStock",
		isGift: false,
	},
};

describe("ephemeris > stringifyJsonLd", () => {
	it("writes no <, > or & at all, and reads back the same", () => {
		const text = stringifyJsonLd(HOSTILE);
		expect(text).not.toMatch(/[<>&\u2028\u2029]/);
		expect(text).toContain("\\u003c/script\\u003e");
		expect(text).toContain("\\u0026");
		expect(text).toContain("\\u2028\\u2029");
		expect(JSON.parse(text)).toEqual(HOSTILE);
	});

	it("leaves undefined out, of objects and of arrays", () => {
		expect(
			toJsonLd({
				"@type": "Thing",
				name: undefined,
				sameAs: ["a", undefined, "b"],
			}),
		).toEqual({ "@type": "Thing", sameAs: ["a", "b"] });
	});

	it("writes a Date as an ISO string, and honours toJSON", () => {
		const price = { toJSON: () => "119.99" };
		expect(
			toJsonLd({
				datePublished: new Date(Date.UTC(2026, 9, 13, 8, 30)),
				price,
			}),
		).toEqual({ datePublished: "2026-10-13T08:30:00.000Z", price: "119.99" });
	});

	it("keeps the same object reached twice, which is not a cycle", () => {
		const brand = { "@type": "Brand", name: "ACME" };
		expect(toJsonLd({ a: brand, b: [brand] })).toEqual({
			a: brand,
			b: [brand],
		});
	});

	it("keeps a __proto__ key as data, not as a prototype", () => {
		const data = JSON.parse('{"__proto__": {"polluted": true}, "name": "x"}');
		const out = toJsonLd(data);
		expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
		expect(Object.keys(out ?? {})).toEqual(["__proto__", "name"]);
		expect(stringifyJsonLd(data)).toBe(
			'{"__proto__":{"polluted":true},"name":"x"}',
		);
	});

	it.each([
		[
			"a function",
			{ name: () => "x" },
			"E_EPHEMERIS_INVALID_VALUE",
			/name is a function/,
		],
		[
			"a symbol",
			{ name: Symbol("x") },
			"E_EPHEMERIS_INVALID_VALUE",
			/name is a symbol/,
		],
		[
			"a bigint",
			{ price: 10n },
			"E_EPHEMERIS_INVALID_VALUE",
			/price is a bigint/,
		],
		[
			"NaN",
			{ offers: [{ price: Number.NaN }] },
			"E_EPHEMERIS_INVALID_VALUE",
			/offers\[0\]\.price is NaN/,
		],
		[
			"Infinity",
			{ price: Number.POSITIVE_INFINITY },
			"E_EPHEMERIS_INVALID_VALUE",
			/price is Infinity/,
		],
		[
			"a Map",
			{ sameAs: new Map() },
			"E_EPHEMERIS_INVALID_VALUE",
			/sameAs is a Map/,
		],
		[
			"an invalid Date",
			{ datePublished: new Date("nope") },
			"E_EPHEMERIS_INVALID_VALUE",
			/invalid Date/,
		],
	])("refuses %s, naming where it is", (name, data, code, message) => {
		const error = refusal(() => stringifyJsonLd(data));
		expect(error.code, name).toBe(code);
		expect(error.message, name).toMatch(message);
	});

	it("leaves out what a toJSON turns into nothing, and refuses a document that is nothing", () => {
		const nothing = { toJSON: () => undefined };
		expect(toJsonLd({ name: "x", hidden: nothing })).toEqual({ name: "x" });
		expect(refusal(() => toJsonLd(nothing)).message).toMatch(/gave nothing/);
	});

	it("takes an object without a prototype as a plain one", () => {
		const bare: Record<string, unknown> = Object.create(null);
		bare.name = "Anvil";
		expect(toJsonLd({ about: bare })).toEqual({ about: { name: "Anvil" } });
	});

	it("keeps null, which JSON holds", () => {
		expect(toJsonLd({ "@type": "Thing", name: null })).toEqual({
			"@type": "Thing",
			name: null,
		});
	});

	it("names an object without a constructor plainly", () => {
		const exotic: object = Object.create(Object.create(null));
		expect(refusal(() => toJsonLd({ about: exotic })).message).toMatch(
			/about is a object/,
		);
	});

	it("refuses a cycle", () => {
		const node: Record<string, unknown> = { "@type": "Thing" };
		node.subjectOf = { about: node };
		const error = refusal(() => stringifyJsonLd(node));
		expect(error.code).toBe("E_EPHEMERIS_CYCLE");
		expect(error.message).toMatch(/subjectOf\.about contains itself/);
	});

	it("refuses data nested deeper than any document", () => {
		let deep: Record<string, unknown> = { name: "bottom" };
		for (let i = 0; i < 100; i++) deep = { hasPart: deep };
		expect(refusal(() => stringifyJsonLd(deep)).code).toBe(
			"E_EPHEMERIS_TOO_DEEP",
		);
	});
});

describe("ephemeris > jsonLdScriptTag", () => {
	it("wraps the text in a JSON-LD script", () => {
		expect(jsonLdScriptTag({ "@type": "Thing", name: "a<b" })).toBe(
			'<script type="application/ld+json">{"@type":"Thing","name":"a\\u003cb"}</script>',
		);
	});

	it("carries the nonce it is given, escaped, and none when there is none", () => {
		expect(jsonLdScriptTag({}, { nonce: "r4nd0m==" })).toBe(
			'<script type="application/ld+json" nonce="r4nd0m==">{}</script>',
		);
		expect(jsonLdScriptTag({}, { nonce: `x"><script>'` })).toContain(
			'nonce="x&quot;&gt;&lt;script&gt;&#39;"',
		);
		expect(jsonLdScriptTag({}, { nonce: "" })).toBe(
			'<script type="application/ld+json">{}</script>',
		);
		expect(jsonLdScriptTag({})).not.toContain("nonce");
	});
});
