/**
 * Bug 008: a node given to the graph without a helper is held to the same
 * bounds as a helper's output — URL-only properties absolute http(s),
 * URL-or-text properties never an executable scheme, text bounded.
 */
import { Exception } from "@c9up/flare";
import { describe, expect, it } from "vitest";
import { MAX_TEXT_LENGTH, product, SchemaGraph } from "../../src/index.js";

const PAGE = "https://shop.example/anvil";

function code(build: () => unknown): string {
	try {
		build();
	} catch (error) {
		if (error instanceof Exception && error.code !== undefined)
			return error.code;
		throw error;
	}
	throw new Error("expected a refusal");
}

const graph = () => new SchemaGraph({ url: PAGE });

describe("SchemaGraph holds raw nodes to the helpers' bounds", () => {
	it("refuses a javascript: url on the main entity", () => {
		expect(
			code(() =>
				graph().mainEntity({
					"@type": "Product",
					name: "Anvil",
					url: "javascript:alert(document.cookie)",
				}),
			),
		).toBe("E_EPHEMERIS_INVALID_URL");
	});

	it("refuses a data: image and a vbscript: sameAs on any slot", () => {
		expect(
			code(() =>
				graph().identity({
					"@type": "Organization",
					name: "ACME",
					sameAs: ["https://acme.example", "vbscript:msgbox"],
				}),
			),
		).toBe("E_EPHEMERIS_INVALID_URL");
		expect(
			code(() =>
				graph().add({
					"@type": "Product",
					name: "Anvil",
					image: "data:text/html,<script>alert(1)</script>",
				}),
			),
		).toBe("E_EPHEMERIS_INVALID_URL");
	});

	it("refuses an executable URL nested in a node", () => {
		expect(
			code(() =>
				graph().webPage({
					"@type": "WebPage",
					name: "Anvil",
					author: { "@type": "Person", name: "Ada", url: "javascript:x" },
				}),
			),
		).toBe("E_EPHEMERIS_INVALID_URL");
	});

	it("refuses text longer than the helpers allow", () => {
		expect(
			code(() =>
				graph().mainEntity({
					"@type": "Product",
					name: "x".repeat(MAX_TEXT_LENGTH + 1),
				}),
			),
		).toBe("E_EPHEMERIS_TOO_LONG");
	});

	it("refuses a price or a currency a helper would refuse", () => {
		expect(
			code(() =>
				graph().add({
					"@type": "Offer",
					price: "1,000.00",
					priceCurrency: "CHF",
				}),
			),
		).toBe("E_EPHEMERIS_INVALID_PRICE");
	});

	it("keeps text in a URL-or-text property, and a relative @id", () => {
		const ld = graph()
			.mainEntity({
				"@type": "Product",
				name: "Anvil",
				image: "https://shop.example/anvil.png",
				url: "https://shop.example/anvil",
			})
			.add({ "@type": "Person", "@id": "#author", name: "Ada" })
			.toJsonLd();
		expect(ld["@graph"]).toHaveLength(2);
	});

	it("still takes a helper's output as checked", () => {
		const node = product({
			"@type": "Product",
			name: "Anvil",
			image: "https://shop.example/anvil.png",
			offers: {
				"@type": "Offer",
				price: "10.00",
				priceCurrency: "CHF",
				availability: "https://schema.org/InStock",
			},
		});
		expect(() => graph().mainEntity(node)).not.toThrow();
	});
});
