import { describe, expect, it } from "vitest";
import {
	EphemerisError,
	event,
	organization,
	person,
	product,
	stringifyJsonLd,
} from "../../src/index.js";
import type { OrganizationLeaf } from "../../src/schema.js";

/**
 * The helpers hold to their forms what the serializer will WRITE, not only
 * the strings they are handed: a `URL`, a Decimal or any value with `toJSON`
 * is written as what its `toJSON` gives, so that is what is checked.
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

/** A node with `key` set to a value its declared type does not allow. */
function organizationWith(key: string, value: unknown): OrganizationLeaf {
	const node: OrganizationLeaf = { "@type": "Organization", name: "ACME" };
	Reflect.set(node, key, value);
	return node;
}

describe("ephemeris > helpers > values written through toJSON", () => {
	it("refuses a URL instance with a javascript: scheme", () => {
		const error = refusal(() =>
			organization(
				organizationWith("url", new URL("javascript:alert(1)")),
				silent,
			),
		);
		expect(error.code).toBe("E_EPHEMERIS_INVALID_URL");
		expect(error.message).toMatch(/^organization\.url must be an http\(s\)/);
	});

	it("refuses a data: URL instance in sameAs and in a nested logo", () => {
		expect(
			refusal(() =>
				organization(
					organizationWith("sameAs", [
						new URL("https://a.example"),
						new URL("data:text/html,<script>alert(1)</script>"),
					]),
					silent,
				),
			).message,
		).toMatch(/sameAs\[1\]/);
		expect(
			refusal(() =>
				organization(
					organizationWith("logo", {
						"@type": "ImageObject",
						contentUrl: new URL("data:text/html,<script>alert(1)</script>"),
					}),
					silent,
				),
			).code,
		).toBe("E_EPHEMERIS_INVALID_URL");
	});

	it("keeps an https URL instance, written as its href", () => {
		const node = organizationWith("url", new URL("https://acme.example/"));
		expect(organization(node, silent)).toBe(node);
		expect(stringifyJsonLd(node)).toContain('"url":"https://acme.example/"');
	});

	it("bounds the text a toJSON gives", () => {
		const error = refusal(() =>
			organization(
				organizationWith("name", { toJSON: () => "A".repeat(10_001) }),
				silent,
			),
		);
		expect(error.code).toBe("E_EPHEMERIS_TOO_LONG");
		expect(error.message).toMatch(/^organization\.name is 10001 characters/);
	});

	it("holds a price and a currency given through toJSON to their forms", () => {
		const offer = (price: unknown, priceCurrency: unknown) => {
			const node: Record<string, unknown> = { "@type": "Offer" };
			Reflect.set(node, "price", price);
			Reflect.set(node, "priceCurrency", priceCurrency);
			return node;
		};
		const productOf = (offers: Record<string, unknown>) => {
			const node = {
				"@type": "Product" as const,
				name: "Anvil",
				image: "https://shop.example/anvil.jpg",
			};
			Reflect.set(node, "offers", offers);
			return node;
		};
		expect(
			refusal(() =>
				product(productOf(offer({ toJSON: () => "CHF 12" }, "CHF")), silent),
			).code,
		).toBe("E_EPHEMERIS_INVALID_PRICE");
		expect(
			refusal(() =>
				product(productOf(offer("12", { toJSON: () => "Francs" })), silent),
			).code,
		).toBe("E_EPHEMERIS_INVALID_CURRENCY");
		// A Decimal writes its digits: that is a price Google reads.
		class Decimal {
			readonly #digits: string;
			constructor(digits: string) {
				this.#digits = digits;
			}
			toJSON(): string {
				return this.#digits;
			}
		}
		const node = productOf(offer(new Decimal("12.50"), "CHF"));
		expect(product(node, silent)).toBe(node);
		expect(stringifyJsonLd(node)).toContain('"price":"12.50"');
	});

	it("checks a Date as the ISO string it is written as", () => {
		// Under a date key it is a date-time with its zone.
		const node = {
			"@type": "Event" as const,
			name: "Launch",
			location: { "@type": "Place" as const, address: "Bern" },
		};
		Reflect.set(node, "startDate", new Date(Date.UTC(2026, 0, 1, 10)));
		expect(event(node, silent)).toBe(node);
		// Under a URL key it is not a URL.
		expect(
			refusal(() => organization(organizationWith("url", new Date(0)), silent))
				.code,
		).toBe("E_EPHEMERIS_INVALID_URL");
		// An invalid Date is refused, as the serializer refuses it.
		const born = { "@type": "Person" as const, name: "Ada" };
		Reflect.set(born, "birthDate", new Date(Number.NaN));
		expect(refusal(() => person(born)).code).toBe("E_EPHEMERIS_INVALID_VALUE");
	});

	it("refuses an object JSON would write as {}", () => {
		for (const value of [new Map([["a", 1]]), new Set([1]), new (class {})()]) {
			const error = refusal(() =>
				organization(organizationWith("address", value), silent),
			);
			expect(error.code).toBe("E_EPHEMERIS_INVALID_VALUE");
			expect(error.message).toMatch(/^organization\.address is a /);
		}
	});

	it("calls toJSON once, as the serializer does", () => {
		let calls = 0;
		const twice = {
			toJSON() {
				calls++;
				return { toJSON: () => "javascript:alert(1)" };
			},
		};
		// The serializer does not call the second toJSON: the plain object it
		// got is written as its (empty) data, so nothing executable is written.
		const node = organizationWith("url", twice);
		expect(organization(node, silent)).toBe(node);
		expect(calls).toBe(1);
		expect(stringifyJsonLd(node)).toContain('"url":{}');
	});
});

describe("ephemeris > helpers > keys that reach a prototype", () => {
	it("refuses an own __proto__, constructor or prototype key, as the graph does", () => {
		for (const key of ["__proto__", "constructor", "prototype"]) {
			const logo: Record<string, unknown> = { "@type": "ImageObject" };
			// An own data property, as JSON.parse defines it.
			Object.defineProperty(logo, key, {
				value: { polluted: true },
				enumerable: true,
				writable: true,
				configurable: true,
			});
			const error = refusal(() =>
				organization(organizationWith("logo", logo), silent),
			);
			expect(error.code).toBe("E_EPHEMERIS_UNSAFE_KEY");
			expect(error.message).toBe(
				`organization.logo.${key} is not a key structured data may use`,
			);
		}
	});
});
