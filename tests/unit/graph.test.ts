import { describe, expect, it } from "vitest";
import {
	EphemerisError,
	SchemaGraph,
	stringifyJsonLd,
} from "../../src/index.js";
import type { Product } from "../../src/schema.js";

const URL_ = "https://shop.example/anvils/executive?ref=home#reviews";
const PAGE = "https://shop.example/anvils/executive?ref=home";

function refusal(build: () => unknown): EphemerisError {
	try {
		build();
	} catch (error) {
		if (error instanceof EphemerisError) return error;
		throw error;
	}
	throw new Error("expected a refusal");
}

function full(): SchemaGraph {
	return new SchemaGraph({ url: URL_ })
		.identity({ "@type": "Organization", name: "ACME" })
		.website({ "@type": "WebSite", name: "ACME shop" })
		.webPage({ "@type": "ItemPage", name: "Executive Anvil" })
		.breadcrumb({
			"@type": "BreadcrumbList",
			itemListElement: [
				{
					"@type": "ListItem",
					position: 1,
					name: "Anvils",
					item: "https://shop.example/anvils",
				},
			],
		})
		.mainEntity({ "@type": "Product", name: "Executive Anvil" });
}

describe("ephemeris > SchemaGraph @ids", () => {
	it("puts the identity and website on the site, the rest on the page", () => {
		const graph = full().toJsonLd()["@graph"];
		expect(graph.map((node) => Reflect.get(Object(node), "@id"))).toEqual([
			"https://shop.example/#identity",
			"https://shop.example/#website",
			`${PAGE}#webpage`,
			`${PAGE}#breadcrumb`,
			`${PAGE}#main-entity`,
		]);
	});

	it("takes the site it is given", () => {
		const graph = new SchemaGraph({
			url: URL_,
			site: "https://acme.example/shop/",
		})
			.identity({ "@type": "Corporation", name: "ACME" })
			.toJsonLd()["@graph"];
		expect(graph[0]).toMatchObject({
			"@id": "https://acme.example/shop/#identity",
		});
	});

	it("numbers other nodes by type, or names them, and keeps the @id they have", () => {
		const graph = new SchemaGraph({ url: URL_ })
			.add({ "@type": "LocalBusiness", name: "Shop A" })
			.add({ "@type": "LocalBusiness", name: "Shop B" })
			.add({ "@type": "Offer", price: 12 }, { id: "sku 42" })
			.add({ "@type": "3DModel", name: "Anvil" })
			.add({
				"@type": "Person",
				"@id": "https://people.example/ada",
				name: "Ada",
			})
			.add({ "@type": "Person", "@id": "#author", name: "Bob" })
			.toJsonLd()["@graph"];
		expect(graph.map((node) => Reflect.get(Object(node), "@id"))).toEqual([
			`${PAGE}#/schema/local-business/1`,
			`${PAGE}#/schema/local-business/2`,
			`${PAGE}#/schema/offer/sku%2042`,
			`${PAGE}#/schema/3d-model/1`,
			"https://people.example/ada",
			`${PAGE}#author`,
		]);
	});
});

describe("ephemeris > SchemaGraph links", () => {
	it("links the root nodes that are there", () => {
		const [identity, website, webPage, breadcrumb, product] =
			full().toJsonLd()["@graph"];
		expect(identity).toEqual({
			"@type": "Organization",
			"@id": "https://shop.example/#identity",
			name: "ACME",
		});
		expect(website).toMatchObject({
			publisher: { "@id": "https://shop.example/#identity" },
		});
		expect(webPage).toMatchObject({
			isPartOf: { "@id": "https://shop.example/#website" },
			breadcrumb: { "@id": `${PAGE}#breadcrumb` },
			mainEntity: { "@id": `${PAGE}#main-entity` },
		});
		expect(breadcrumb).not.toHaveProperty("isPartOf");
		expect(product).toMatchObject({
			mainEntityOfPage: { "@id": `${PAGE}#webpage` },
		});
	});

	it("leaves no reference to a node that is not there", () => {
		const graph = new SchemaGraph({ url: URL_ })
			.website({ "@type": "WebSite", name: "ACME shop" })
			.webPage({ "@type": "WebPage", name: "Home" })
			.toJsonLd()["@graph"];
		const text = JSON.stringify(graph);
		expect(text).not.toContain("#identity");
		expect(text).not.toContain("#breadcrumb");
		expect(text).not.toContain("#main-entity");
		expect(graph[1]).toMatchObject({
			isPartOf: { "@id": "https://shop.example/#website" },
		});
	});

	it("never replaces a link the caller set", () => {
		const graph = new SchemaGraph({ url: URL_ })
			.identity({ "@type": "Organization", name: "ACME" })
			.website({
				"@type": "WebSite",
				publisher: { "@id": "https://other.example/#org" },
			})
			.toJsonLd()["@graph"];
		expect(graph[1]).toMatchObject({
			publisher: { "@id": "https://other.example/#org" },
		});
	});

	it("does not change what it was given, and gives the same graph twice", () => {
		const graph = full();
		const first = stringifyJsonLd(graph.toJsonLd());
		expect(stringifyJsonLd(graph.toJsonLd())).toBe(first);
		const node: Product = { "@type": "Product", name: "Anvil" };
		new SchemaGraph({ url: URL_ }).mainEntity(node).toJsonLd();
		expect(node).toEqual({ "@type": "Product", name: "Anvil" });
	});
});

describe("ephemeris > SchemaGraph layers", () => {
	it("merges two declarations of a node: types united, the later value wins", () => {
		const graph = new SchemaGraph({ url: URL_ })
			.identity({
				"@type": "Organization",
				name: "ACME",
				url: "https://shop.example",
			})
			.identity({
				"@type": "Store",
				name: "ACME Store",
				telephone: "+41 21 000 00 00",
			})
			.add({ "@type": "Person", "@id": "#author", name: "Ada" })
			.add({ "@type": "Person", "@id": "#author", jobTitle: "Editor" })
			.toJsonLd()["@graph"];
		expect(graph).toEqual([
			{
				"@type": ["Organization", "Store"],
				"@id": "https://shop.example/#identity",
				name: "ACME Store",
				telephone: "+41 21 000 00 00",
				url: "https://shop.example",
			},
			{
				"@type": "Person",
				"@id": `${PAGE}#author`,
				jobTitle: "Editor",
				name: "Ada",
			},
		]);
	});

	it("does not let an empty value of a later layer erase an earlier one", () => {
		const graph = new SchemaGraph({ url: URL_ })
			.webPage({
				"@type": "WebPage",
				name: "Anvil",
				description: "A heavy anvil",
			})
			.webPage({ "@type": "WebPage", description: "" })
			.toJsonLd()["@graph"];
		expect(graph[0]).toMatchObject({ description: "A heavy anvil" });
	});

	it("refuses keys that reach a prototype, at any depth", () => {
		for (const node of [
			JSON.parse('{"@type": "Thing", "__proto__": {"polluted": true}}'),
			{ "@type": "Thing", constructor: "x" },
			{
				"@type": "Thing",
				subjectOf: { "@type": "CreativeWork", prototype: {} },
			},
		]) {
			expect(refusal(() => new SchemaGraph({ url: URL_ }).add(node)).code).toBe(
				"E_EPHEMERIS_UNSAFE_KEY",
			);
		}
		expect(Reflect.get({}, "polluted")).toBeUndefined();
	});
});

describe("ephemeris > SchemaGraph values", () => {
	it("invents nothing: what was not given is not there", () => {
		const headline =
			"A headline that is long enough to be cut by a tool that would cut it at one hundred and ten characters, but not here";
		const graph = new SchemaGraph({ url: URL_ })
			.mainEntity({
				"@type": "Product",
				name: "Anvil",
				offers: { "@type": "Offer", price: "119.99", priceCurrency: "CHF" },
			})
			.add({ "@type": "Article", headline })
			.toJsonLd()["@graph"];
		expect(graph[0]).toEqual({
			"@type": "Product",
			"@id": `${PAGE}#main-entity`,
			name: "Anvil",
			offers: { "@type": "Offer", price: "119.99", priceCurrency: "CHF" },
		});
		expect(graph[1]).toMatchObject({ headline });
	});

	it("drops empty values: undefined, null, empty strings, arrays and objects", () => {
		// As a database row arrives: nulls included.
		const row = JSON.parse(
			'{"@type": "Product", "name": "Anvil", "description": "", "sku": null, "image": [], "brand": {"@type": "Brand", "name": ""}, "sameAs": ["", "https://wiki.example/anvil"], "award": null, "review": [{}]}',
		);
		const graph = new SchemaGraph({ url: URL_ })
			.add({ ...row, gtin: undefined })
			.toJsonLd()["@graph"];
		expect(graph[0]).toEqual({
			"@type": "Product",
			"@id": `${PAGE}#/schema/product/1`,
			brand: { "@type": "Brand" },
			name: "Anvil",
			sameAs: ["https://wiki.example/anvil"],
		});
	});

	it("takes a node of several types, and orders keywords before properties", () => {
		const graph = new SchemaGraph({ url: URL_ })
			.webPage({ "@type": "WebPage", "@id": "#page", name: "Anvil" })
			.add(
				JSON.parse(
					'{"@type": ["Product", "SoftwareApplication"], "name": {"@value": "Enclume", "@language": "fr"}}',
				),
			)
			.toJsonLd()["@graph"];
		expect(graph[0]).toMatchObject({ "@id": `${PAGE}#page` });
		expect(JSON.stringify(graph[1])).toBe(
			`{"@type":["Product","SoftwareApplication"],"@id":"${PAGE}#/schema/product/1","name":{"@language":"fr","@value":"Enclume"}}`,
		);
	});

	it("writes the same bytes whatever order the keys came in", () => {
		const a = new SchemaGraph({ url: URL_ }).mainEntity({
			"@type": "Product",
			sku: "1",
			name: "A",
			brand: { name: "B", "@type": "Brand" },
		});
		const b = new SchemaGraph({ url: URL_ }).mainEntity({
			name: "A",
			brand: { "@type": "Brand", name: "B" },
			"@type": "Product",
			sku: "1",
		});
		expect(stringifyJsonLd(a.toJsonLd())).toBe(stringifyJsonLd(b.toJsonLd()));
	});
});

describe("ephemeris > SchemaGraph refusals", () => {
	it.each([
		["a relative URL", "/anvils"],
		["a javascript: URL", "javascript:alert(1)"],
		["an ftp URL", "ftp://shop.example/"],
	])("refuses %s as the page", (_name, url) => {
		expect(refusal(() => new SchemaGraph({ url })).code).toBe(
			"E_EPHEMERIS_INVALID_URL",
		);
	});

	it("refuses a site that is not an http(s) URL", () => {
		expect(
			refusal(() => new SchemaGraph({ url: URL_, site: "data:," })).code,
		).toBe("E_EPHEMERIS_INVALID_URL");
	});

	it("refuses a node without a type, or that is not a plain object", () => {
		const graph = new SchemaGraph({ url: URL_ });
		expect(refusal(() => graph.add(JSON.parse('{"name": "x"}'))).code).toBe(
			"E_EPHEMERIS_INVALID_NODE",
		);
		expect(refusal(() => graph.add(JSON.parse('{"@type": ""}'))).code).toBe(
			"E_EPHEMERIS_INVALID_NODE",
		);
		class Product {
			readonly "@type" = "Product";
		}
		expect(refusal(() => graph.add(new Product())).code).toBe(
			"E_EPHEMERIS_INVALID_NODE",
		);
	});
});
