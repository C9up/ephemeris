import { describe, expect, it } from "vitest";
import {
	breadcrumb,
	EphemerisError,
	event,
	imageObject,
	merchantReturnPolicy,
	organization,
	person,
	product,
	profilePage,
	recipe,
	review,
	SchemaGraph,
	stringifyJsonLd,
	toJsonLd,
} from "../../src/index.js";
import type {
	CreativeWorkLeaf,
	OrganizationLeaf,
	PersonLeaf,
} from "../../src/schema.js";

/**
 * One test per defect a review of 0.1.0 reproduced: each input once gave a raw
 * error, a wrong output or a check skipped.
 */

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
const URL_ = "https://shop.example/anvils/executive";

/**
 * Creative works each the subject of the next, `levels` deep — built by a
 * loop: a JSON round trip of it would overflow the stack before the code
 * under test ever ran.
 */
function nested(levels: number): CreativeWorkLeaf {
	let value: CreativeWorkLeaf = { "@type": "CreativeWork", name: "bottom" };
	for (let i = 0; i < levels; i++) {
		value = { "@type": "CreativeWork", subjectOf: value };
	}
	return value;
}

describe("ephemeris > review fixes > cycles and depth", () => {
	it("refuses a cycle in a helper and in the graph, not a stack overflow", () => {
		const cyclic: OrganizationLeaf = { "@type": "Organization", name: "A" };
		cyclic.parentOrganization = cyclic;
		expect(refusal(() => organization(cyclic, silent)).code).toBe(
			"E_EPHEMERIS_CYCLE",
		);
		expect(refusal(() => new SchemaGraph({ url: URL_ }).add(cyclic)).code).toBe(
			"E_EPHEMERIS_CYCLE",
		);
	});

	it("refuses data nested 20,000 deep in a helper and in the graph", () => {
		const deep = {
			"@type": "Person",
			subjectOf: nested(20_000),
		} as const;
		expect(refusal(() => person(deep)).code).toBe("E_EPHEMERIS_TOO_DEEP");
		expect(refusal(() => new SchemaGraph({ url: URL_ }).add(deep)).code).toBe(
			"E_EPHEMERIS_TOO_DEEP",
		);
	});
});

describe("ephemeris > review fixes > a Date from a database row", () => {
	it("is passed through by the helpers and the graph, then written in UTC", () => {
		const node: PersonLeaf = { "@type": "Person", name: "Ada" };
		Object.assign(node, { birthDate: new Date(Date.UTC(1815, 11, 10)) });
		expect(person(node)).toBe(node);
		const graph = new SchemaGraph({ url: URL_ }).add(node).toJsonLd();
		expect(stringifyJsonLd(graph)).toContain(
			'"birthDate":"1815-12-10T00:00:00.000Z"',
		);
	});
});

describe("ephemeris > review fixes > checks no longer skipped", () => {
	it("checks an empty object instead of taking it for a reference", () => {
		expect(
			refusal(() =>
				review(
					{
						"@type": "Review",
						author: "x",
						itemReviewed: { "@type": "Thing", name: "n" },
						reviewRating: JSON.parse("{}"),
					},
					silent,
				),
			),
		).toMatchObject({ property: "reviewRating.ratingValue" });
		expect(
			refusal(() =>
				product(
					{ "@type": "Product", name: "x", offers: JSON.parse("{}") },
					silent,
				),
			),
		).toMatchObject({
			type: "Offer",
		});
		expect(
			refusal(() =>
				profilePage(
					{ "@type": "ProfilePage", mainEntity: JSON.parse("{}") },
					silent,
				),
			),
		).toMatchObject({
			property: "mainEntity.name or mainEntity.alternateName",
		});
	});

	it("takes null for absent in conditional requirements", () => {
		const row = JSON.parse('{"recipeYield": null, "merchantReturnDays": null}');
		expect(
			refusal(() =>
				recipe(
					{
						"@type": "Recipe",
						name: "Rösti",
						image: "https://a.example/r.jpg",
						nutrition: {
							"@type": "NutritionInformation",
							calories: "270 calories",
						},
						recipeYield: row.recipeYield,
					},
					silent,
				),
			),
		).toMatchObject({ property: "recipeYield" });
		expect(
			refusal(() =>
				merchantReturnPolicy(
					{
						"@type": "MerchantReturnPolicy",
						applicableCountry: "CH",
						merchantReturnLink: "https://a.example/returns",
						returnPolicyCategory: "MerchantReturnFiniteReturnWindow",
						merchantReturnDays: row.merchantReturnDays,
					},
					silent,
				),
			),
		).toMatchObject({ property: "merchantReturnDays" });
	});

	it("counts a hole in a breadcrumb as a missing crumb", () => {
		const holed: { name: string; item?: string }[] = [];
		holed[1] = { name: "Home" };
		expect(refusal(() => breadcrumb(holed))).toMatchObject({
			property: "itemListElement[0].name",
		});
	});
});

describe("ephemeris > review fixes > @ids", () => {
	it("never gives two nodes the same generated @id", () => {
		const graph = new SchemaGraph({ url: URL_ })
			.add({ "@type": "Person", name: "A" }, { id: 1 })
			.add({ "@type": "Person", name: "B" })
			.toJsonLd()["@graph"];
		expect(graph.map((node) => Reflect.get(Object(node), "@id"))).toEqual([
			`${URL_}#/schema/person/1`,
			`${URL_}#/schema/person/2`,
		]);
	});

	it("refuses an @id that is no URL, as an EphemerisError", () => {
		expect(
			refusal(() =>
				new SchemaGraph({ url: URL_ }).add({
					"@type": "Thing",
					"@id": "https://[",
				}),
			).code,
		).toBe("E_EPHEMERIS_INVALID_URL");
		expect(
			refusal(() =>
				new SchemaGraph({ url: URL_ }).identity({
					"@type": "Organization",
					"@id": "http://a b",
				}),
			).code,
		).toBe("E_EPHEMERIS_INVALID_URL");
	});

	it("names a type given as an IRI by its last segment, and encodes it", () => {
		const graph = new SchemaGraph({ url: URL_ })
			.add(JSON.parse('{"@type": "https://schema.org/Product", "name": "A"}'))
			.add(JSON.parse('{"@type": "Foo Bar", "name": "B"}'))
			.add(JSON.parse('{"@type": "ext#Gadget", "name": "C"}'))
			.toJsonLd()["@graph"];
		expect(graph.map((node) => Reflect.get(Object(node), "@id"))).toEqual([
			`${URL_}#/schema/product/1`,
			`${URL_}#/schema/foo%20bar/1`,
			`${URL_}#/schema/gadget/1`,
		]);
	});

	it("resolves the identity's relative @id against the site, the same on every page", () => {
		const idOn = (url: string) =>
			Reflect.get(
				Object(
					new SchemaGraph({ url })
						.identity({ "@type": "Organization", "@id": "#org" })
						.toJsonLd()["@graph"][0],
				),
				"@id",
			);
		expect(idOn("https://x.example/blog/a")).toBe("https://x.example/#org");
		expect(idOn("https://x.example/shop/b")).toBe("https://x.example/#org");
	});

	it("refuses a second, different node in a slot rather than merging it", () => {
		const graph = new SchemaGraph({ url: URL_ }).mainEntity({
			"@type": "Product",
			"@id": "#a",
			name: "A",
		});
		expect(() =>
			graph.mainEntity({ "@type": "Product", "@id": "#a", sku: "1" }),
		).not.toThrow();
		expect(
			refusal(() =>
				graph.mainEntity({ "@type": "Product", "@id": "#b", name: "B" }),
			).code,
		).toBe("E_EPHEMERIS_SLOT_TAKEN");
	});
});

describe("ephemeris > review fixes > values", () => {
	it("refuses javascript: in every URL property", () => {
		expect(
			refusal(() =>
				imageObject(
					{
						"@type": "ImageObject",
						contentUrl: "https://a.example/i.jpg",
						license: "javascript:alert(1)",
					},
					silent,
				),
			).code,
		).toBe("E_EPHEMERIS_INVALID_URL");
		expect(
			refusal(() =>
				merchantReturnPolicy(
					{
						"@type": "MerchantReturnPolicy",
						applicableCountry: "CH",
						returnPolicyCategory: "MerchantReturnNotPermitted",
						merchantReturnLink: "javascript:alert(1)",
					},
					silent,
				),
			).code,
		).toBe("E_EPHEMERIS_INVALID_URL");
	});

	it("takes years before 100, bounds the zone offset, refuses a number for a date", () => {
		expect(() =>
			organization(
				{ "@type": "Organization", foundingDate: "0099-05-01" },
				silent,
			),
		).not.toThrow();
		const at = (startDate: string) => () =>
			event(
				{
					"@type": "Event",
					name: "A",
					startDate,
					location: { "@type": "Place", address: "Rue du Lac 1268, Biel" },
				},
				silent,
			);
		expect(at("2026-01-01T10:00+14:00")).not.toThrow();
		expect(refusal(at("2026-01-01T10:00+99:99")).code).toBe(
			"E_EPHEMERIS_INVALID_DATE",
		);
		expect(refusal(at("2026-01-01T10:00+15:00")).code).toBe(
			"E_EPHEMERIS_INVALID_DATE",
		);
		const row = JSON.parse('{"datePublished": 1700000000}');
		expect(
			refusal(() =>
				organization(
					{ "@type": "Organization", foundingDate: row.datePublished },
					silent,
				),
			).code,
		).toBe("E_EPHEMERIS_INVALID_DATE");
	});

	it("leaves an undefined price out, and refuses one in exponent notation", () => {
		expect(() =>
			product(
				{
					"@type": "Product",
					name: "A",
					offers: {
						"@type": "Offer",
						price: undefined,
						priceCurrency: undefined,
						priceSpecification: {
							"@type": "UnitPriceSpecification",
							price: 5,
							priceCurrency: "CHF",
						},
					},
				},
				silent,
			),
		).not.toThrow();
		for (const price of [1e21, 1e-7]) {
			expect(
				refusal(() =>
					product(
						{
							"@type": "Product",
							name: "A",
							offers: { "@type": "Offer", price, priceCurrency: "CHF" },
						},
						silent,
					),
				).code,
			).toBe("E_EPHEMERIS_INVALID_PRICE");
		}
	});

	it("calls toJSON once, as JSON does", () => {
		class Endless {
			toJSON(): Endless {
				return new Endless();
			}
		}
		expect(refusal(() => toJsonLd({ v: new Endless() })).code).toBe(
			"E_EPHEMERIS_INVALID_VALUE",
		);
		const self = {
			a: 1,
			toJSON() {
				return this;
			},
		};
		expect(toJsonLd({ v: self })).toEqual({ v: { a: 1 } });
	});
});
