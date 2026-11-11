import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	generateScalarProperties,
	generateUrlProperties,
	VOCABULARY_FILE,
} from "../../scripts/schema-generator.js";
import {
	EphemerisError,
	organization,
	SchemaGraph,
	stringifyJsonLd,
} from "../../src/index.js";
import {
	BOOLEAN_PROPERTIES,
	NUMBER_PROPERTIES,
} from "../../src/scalar-properties.js";
import type { OrganizationLeaf } from "../../src/schema.js";
import {
	URL_OR_TEXT_PROPERTIES,
	URL_PROPERTIES,
} from "../../src/url-properties.js";

/**
 * The URL check covers every property the vocabulary ranges over URL, not a
 * hand-picked few: the list is generated from the release the package ships.
 */

const root = fileURLToPath(new URL("../../", import.meta.url));
const vocabulary: unknown = JSON.parse(
	readFileSync(`${root}${VOCABULARY_FILE}`, "utf8"),
);

function refusal(build: () => unknown): EphemerisError {
	try {
		build();
	} catch (error) {
		if (error instanceof EphemerisError) return error;
		throw error;
	}
	throw new Error("expected a refusal");
}

const silent = { onWarning: () => {} };

function organizationWith(key: string, value: unknown): OrganizationLeaf {
	const node: OrganizationLeaf = { "@type": "Organization", name: "ACME" };
	Reflect.set(node, key, value);
	return node;
}

describe("ephemeris > URL properties > generated from the vocabulary", () => {
	it("is up to date with the vendored release", () => {
		expect(readFileSync(`${root}src/url-properties.ts`, "utf8")).toBe(
			generateUrlProperties(vocabulary),
		);
	});

	it("holds every property ranged over URL, strict where no text is allowed", () => {
		// 153 properties have URL in their range; 81 do not accept Text, of
		// which 3 accept a class a plain string may name (a person, a place,
		// an entry point), so a string there may be a name.
		expect(URL_PROPERTIES.size + URL_OR_TEXT_PROPERTIES.size).toBe(153);
		expect(URL_PROPERTIES.size).toBe(78);
		for (const name of ["codeRepository", "relatedLink", "isPartOf"]) {
			expect(URL_PROPERTIES.has(name)).toBe(true);
		}
		for (const name of ["keywords", "colleague", "gameLocation", "target"]) {
			expect(URL_OR_TEXT_PROPERTIES.has(name)).toBe(true);
		}
	});
});

describe("ephemeris > scalar properties > generated from the vocabulary", () => {
	it("is up to date with the vendored release", () => {
		expect(readFileSync(`${root}src/scalar-properties.ts`, "utf8")).toBe(
			generateScalarProperties(vocabulary),
		);
	});

	it("holds the properties ranged over a number or a boolean, through their kinds", () => {
		// Integer and Float are kinds of Number.
		for (const name of ["price", "ratingValue", "position", "offerCount"]) {
			expect(NUMBER_PROPERTIES.has(name)).toBe(true);
		}
		for (const name of ["directApply", "isAccessibleForFree"]) {
			expect(BOOLEAN_PROPERTIES.has(name)).toBe(true);
		}
		for (const name of ["name", "url", "image", "description"]) {
			expect(NUMBER_PROPERTIES.has(name)).toBe(false);
			expect(BOOLEAN_PROPERTIES.has(name)).toBe(false);
		}
	});
});

describe("ephemeris > URL properties > checked in the helpers", () => {
	it("refuses a javascript: URL in every URL-only property", () => {
		for (const key of [
			"codeRepository",
			"relatedLink",
			"replyToUrl",
			"publishingPrinciples",
			"isPartOf",
			"paymentUrl",
		]) {
			const error = refusal(() =>
				organization(organizationWith(key, "javascript:alert(1)"), silent),
			);
			expect(error.code).toBe("E_EPHEMERIS_INVALID_URL");
			expect(error.message).toContain(`organization.${key} must be`);
		}
	});

	it("keeps the Google keys that are not URL-ranged in the vocabulary", () => {
		expect(
			refusal(() =>
				organization(
					organizationWith("potentialAction", {
						"@type": "SearchAction",
						target: { "@type": "EntryPoint", urlTemplate: "javascript:x" },
					}),
					silent,
				),
			).code,
		).toBe("E_EPHEMERIS_INVALID_URL");
	});

	it("refuses an executable URL in a property that also takes text, and keeps text", () => {
		for (const value of [
			"javascript:alert(2)",
			" JavaScript:alert(2)",
			"data:text/html,<script>alert(1)</script>",
			"vbscript:msgbox(1)",
		]) {
			expect(
				refusal(() =>
					organization(organizationWith("additionalType", value), silent),
				).code,
			).toBe("E_EPHEMERIS_INVALID_URL");
		}
		const node = organizationWith("keywords", [
			"javascript is fun",
			"note: anvils",
			"https://schema.org/Anvil",
		]);
		expect(organization(node, silent)).toBe(node);
	});

	it("refuses an executable @id, and keeps a relative or a urn: one", () => {
		for (const id of ["javascript:alert(1)", "data:,x", "file:///etc/passwd"]) {
			const error = refusal(() =>
				organization(
					organizationWith("parentOrganization", { "@id": id }),
					silent,
				),
			);
			expect(error.code).toBe("E_EPHEMERIS_INVALID_URL");
			expect(error.message).toContain("parentOrganization.@id");
		}
		const node = organizationWith("subjectOf", [
			{ "@id": "urn:isbn:9780131103627" },
			{ "@id": "#identity" },
			{ "@id": "https://acme.example/#identity" },
			{ "@id": "mailto:press@acme.example" },
		]);
		expect(organization(node, silent)).toBe(node);
		expect(stringifyJsonLd(node)).toContain("urn:isbn:9780131103627");
	});
});

describe("ephemeris > URL properties > the graph's @id", () => {
	it("refuses a node whose @id resolves to an executable URL", () => {
		const graph = new SchemaGraph({ url: "https://a.example/p" });
		expect(
			refusal(() =>
				graph.add({ "@type": "Thing", "@id": "javascript:alert(1)" }),
			).code,
		).toBe("E_EPHEMERIS_INVALID_URL");
		expect(
			refusal(() =>
				graph.identity({ "@type": "Organization", "@id": "data:,x" }),
			).code,
		).toBe("E_EPHEMERIS_INVALID_URL");
		graph.add({ "@type": "Book", "@id": "urn:isbn:9780131103627" });
		expect(JSON.stringify(graph.toJsonLd())).toContain(
			'"@id":"urn:isbn:9780131103627"',
		);
	});
});
