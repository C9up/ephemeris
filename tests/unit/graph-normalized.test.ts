import { describe, expect, it } from "vitest";
import { EphemerisError, SchemaGraph } from "../../src/index.js";
import type { ProductLeaf } from "../../src/schema.js";

/**
 * What `SchemaGraph.toJsonLd()` returns is what JSON writes back unchanged.
 * Photon, inker and aurora serialize it with plain `JSON.stringify`, which
 * writes `NaN` as `null`, a `Map` as `{}` and a function not at all; the
 * graph refuses those when the node is added, as `jsonLdScriptTag` would.
 */

const PAGE = "https://shop.example/anvil";

function refusal(build: () => unknown): EphemerisError {
	try {
		build();
	} catch (error) {
		if (error instanceof EphemerisError) return error;
		throw error;
	}
	throw new Error("expected a refusal");
}

function productWith(key: string, value: unknown): ProductLeaf {
	const node: ProductLeaf = { "@type": "Product", name: "Anvil" };
	Reflect.set(node, key, value);
	return node;
}

describe("ephemeris > graph > JSON-faithful output", () => {
	it("refuses what JSON would write as something else", () => {
		const offerAt = (price: unknown) => {
			const offer: Record<string, unknown> = { "@type": "Offer" };
			Reflect.set(offer, "price", price);
			return offer;
		};
		for (const node of [
			productWith("weight", Number.NaN),
			productWith("offers", offerAt(Number.POSITIVE_INFINITY)),
			productWith("availableAtOrFrom", new Map([["a", 1]])),
			productWith("isRelatedTo", new (class Anvil {})()),
			productWith("description", () => "x"),
			productWith("sku", 1n),
		]) {
			const error = refusal(() =>
				new SchemaGraph({ url: PAGE }).mainEntity(node).toJsonLd(),
			);
			expect(error.code).toBe("E_EPHEMERIS_INVALID_VALUE");
		}
	});

	it("writes a Date, a URL and any toJSON value as the JSON they give", () => {
		const node = productWith("releaseDate", new Date(Date.UTC(2026, 0, 2)));
		Reflect.set(node, "url", new URL("https://shop.example/anvil"));
		Reflect.set(node, "sku", { toJSON: () => "A-42" });
		const document = new SchemaGraph({ url: PAGE }).mainEntity(node).toJsonLd();
		expect(JSON.parse(JSON.stringify(document))).toEqual(document);
		expect(document["@graph"][0]).toEqual({
			"@type": "Product",
			"@id": `${PAGE}#main-entity`,
			name: "Anvil",
			releaseDate: "2026-01-02T00:00:00.000Z",
			sku: "A-42",
			url: "https://shop.example/anvil",
		});
	});

	it("drops a value whose toJSON gives nothing, as JSON does", () => {
		const node = productWith("sku", { toJSON: () => undefined });
		Reflect.set(node, "gtin", { toJSON: () => "" });
		const [product] = new SchemaGraph({ url: PAGE })
			.mainEntity(node)
			.toJsonLd()["@graph"];
		expect(product).toEqual({
			"@type": "Product",
			"@id": `${PAGE}#main-entity`,
			name: "Anvil",
		});
	});

	it("still refuses an own __proto__ key from parsed data", () => {
		// An own data property, as JSON.parse defines it.
		const node: ProductLeaf = { "@type": "Product" };
		Object.defineProperty(node, "__proto__", {
			value: { polluted: true },
			enumerable: true,
			writable: true,
			configurable: true,
		});
		expect(refusal(() => new SchemaGraph({ url: PAGE }).add(node)).code).toBe(
			"E_EPHEMERIS_UNSAFE_KEY",
		);
	});
});
