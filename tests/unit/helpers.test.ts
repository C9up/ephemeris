import { afterEach, describe, expect, it, vi } from "vitest";
import {
	breadcrumb,
	EphemerisError,
	localBusiness,
	MAX_TEXT_LENGTH,
	organization,
	person,
	profilePage,
	RequirementError,
	type RequirementWarning,
	SchemaGraph,
	webPage,
	website,
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

/** The warnings a build produces, by property. */
function warningsOf(
	build: (onWarning: (w: RequirementWarning) => void) => unknown,
): RequirementWarning[] {
	const warnings: RequirementWarning[] = [];
	build((warning) => warnings.push(warning));
	return warnings;
}

const ADDRESS = {
	"@type": "PostalAddress",
	streetAddress: "Rue du Lac 1268",
	addressLocality: "Biel",
	addressRegion: "BE",
	postalCode: "2501",
	addressCountry: "CH",
} as const;

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ephemeris > organization", () => {
	it("requires nothing, and recommends what Google lists", () => {
		const warnings = warningsOf((onWarning) =>
			organization({ "@type": "Organization", name: "ACME" }, { onWarning }),
		);
		const properties = warnings.map((w) => w.property);
		expect(properties).toContain("url");
		expect(properties).toContain("logo");
		expect(properties).not.toContain("name");
		expect(warnings[0]).toMatchObject({
			code: "W_EPHEMERIS_MISSING_RECOMMENDED",
			type: "Organization",
			source:
				"https://developers.google.com/search/docs/appearance/structured-data/organization",
		});
	});

	it("checks the address's parts only when the address is an object", () => {
		const asText = warningsOf((onWarning) =>
			organization(
				{ "@type": "Organization", address: "Rue du Lac 1268, Biel" },
				{ onWarning },
			),
		).map((w) => w.property);
		expect(asText.filter((p) => p.startsWith("address."))).toEqual([]);
		const partial = warningsOf((onWarning) =>
			organization(
				{
					"@type": "Organization",
					address: { "@type": "PostalAddress", addressLocality: "Biel" },
				},
				{ onWarning },
			),
		).map((w) => w.property);
		expect(partial).toContain("address.postalCode");
		expect(partial).not.toContain("address.addressLocality");
	});

	it("writes each kind of warning once by default", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		organization({ "@type": "Corporation", name: "A" });
		const first = warn.mock.calls.length;
		organization({ "@type": "Corporation", name: "B" });
		expect(first).toBeGreaterThan(0);
		expect(warn.mock.calls.length).toBe(first);
		expect(String(warn.mock.calls[0]?.[0])).toMatch(
			/^\[ephemeris\] Organization has no /,
		);
	});

	it("is silenced by a handler that does nothing", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		organization({ "@type": "NGO" }, { onWarning: () => {} });
		expect(warn).not.toHaveBeenCalled();
	});

	it("returns the node it was given", () => {
		const node = { "@type": "Organization", name: "ACME" } as const;
		expect(organization(node, { onWarning: () => {} })).toBe(node);
	});
});

describe("ephemeris > localBusiness", () => {
	it("requires a name and an address", () => {
		const silent = { onWarning: () => {} };
		const cases = [
			[
				"name",
				() => localBusiness({ "@type": "Store", address: ADDRESS }, silent),
			],
			[
				"address",
				() => localBusiness({ "@type": "Store", name: "ACME" }, silent),
			],
		] as const;
		for (const [property, build] of cases) {
			const error = refusal(build);
			expect(error).toBeInstanceOf(RequirementError);
			expect(error.code).toBe("E_EPHEMERIS_MISSING_REQUIRED");
			expect(error).toMatchObject({
				type: "LocalBusiness",
				property,
				source:
					"https://developers.google.com/search/docs/appearance/structured-data/local-business",
			});
		}
	});

	it("warns of coordinates under five decimals and of a price range Google will not show", () => {
		const warnings = warningsOf((onWarning) =>
			localBusiness(
				{
					"@type": "Restaurant",
					name: "Chez A",
					address: ADDRESS,
					geo: {
						"@type": "GeoCoordinates",
						latitude: 47.13,
						longitude: "7.24672",
					},
					priceRange: "CHF ".repeat(30),
				},
				{ onWarning },
			),
		);
		expect(
			warnings.filter((w) => w.code !== "W_EPHEMERIS_MISSING_RECOMMENDED"),
		).toEqual([
			expect.objectContaining({
				code: "W_EPHEMERIS_LOW_PRECISION",
				property: "geo.latitude",
			}),
			expect.objectContaining({
				code: "W_EPHEMERIS_TOO_LONG_FOR_GOOGLE",
				property: "priceRange",
			}),
		]);
	});

	it("counts no decimals in a whole or missing coordinate, and skips a referenced place", () => {
		// As a database row arrives: types the generated ones would refuse.
		const row = JSON.parse(
			'{"geo": {"@type": "GeoCoordinates", "latitude": 47, "longitude": {"@id": "#lon"}}, "priceRange": 3}',
		);
		const warnings = warningsOf((onWarning) => {
			localBusiness(
				{ "@type": "Store", name: "A", address: ADDRESS, ...row },
				{ onWarning },
			);
			localBusiness(
				{
					"@type": "Store",
					name: "B",
					address: ADDRESS,
					geo: { "@id": "#geo" },
				},
				{ onWarning },
			);
			localBusiness(
				{
					"@type": "Store",
					name: "C",
					address: ADDRESS,
					geo: { "@type": "GeoCoordinates", longitude: 7.24672 },
				},
				{ onWarning },
			);
			localBusiness(
				{ "@type": "Store", name: "D", address: ADDRESS },
				{ onWarning },
			);
		});
		expect(
			warnings
				.filter((w) => w.code === "W_EPHEMERIS_LOW_PRECISION")
				.map((w) => w.message),
		).toEqual([
			"LocalBusiness geo.latitude has 0 decimals; Google needs at least 5",
			"LocalBusiness geo.longitude has 0 decimals; Google needs at least 5",
		]);
	});

	it("does not look into what is not a plain object", () => {
		const warnings = warningsOf((onWarning) =>
			organization(
				{ "@type": "Organization", address: JSON.parse("[]") },
				{ onWarning },
			),
		);
		expect(warnings.map((w) => w.property)).toContain("address");
	});

	it("has nothing to say about a complete business", () => {
		const warnings = warningsOf((onWarning) =>
			localBusiness(
				{
					"@type": "Store",
					name: "ACME",
					address: ADDRESS,
					url: "https://acme.example/biel",
					telephone: "+41 32 000 00 00",
					priceRange: "$$",
					geo: {
						"@type": "GeoCoordinates",
						latitude: 47.13702,
						longitude: 7.24672,
					},
					openingHoursSpecification: [
						{
							"@type": "OpeningHoursSpecification",
							dayOfWeek: "Monday",
							opens: "08:00",
							closes: "18:00",
						},
					],
				},
				{ onWarning },
			),
		);
		expect(warnings).toEqual([]);
	});
});

describe("ephemeris > website and profilePage", () => {
	it("requires a website's name and url, and recommends an alternate name", () => {
		expect(
			refusal(() => website({ "@type": "WebSite", name: "ACME" })),
		).toMatchObject({ property: "url" });
		const warnings = warningsOf((onWarning) =>
			website(
				{ "@type": "WebSite", name: "ACME", url: "https://acme.example/" },
				{ onWarning },
			),
		);
		expect(warnings.map((w) => w.property)).toEqual(["alternateName"]);
	});

	it("requires a profile's main entity and its name, or an alternate one", () => {
		expect(
			refusal(() => profilePage({ "@type": "ProfilePage" })),
		).toMatchObject({ property: "mainEntity" });
		expect(
			refusal(() =>
				profilePage({
					"@type": "ProfilePage",
					mainEntity: { "@type": "Person", jobTitle: "Editor" },
				}),
			),
		).toMatchObject({
			property: "mainEntity.name or mainEntity.alternateName",
		});
		const silent = { onWarning: () => {} };
		expect(() =>
			profilePage(
				{
					"@type": "ProfilePage",
					mainEntity: { "@type": "Person", alternateName: "ada" },
				},
				silent,
			),
		).not.toThrow();
		// A reference: the person is described elsewhere in the graph.
		expect(() =>
			profilePage(
				{
					"@type": "ProfilePage",
					mainEntity: { "@id": "https://acme.example/#ada" },
				},
				silent,
			),
		).not.toThrow();
	});
});

describe("ephemeris > breadcrumb", () => {
	it("numbers the trail from 1, and lets the last crumb leave its URL out", () => {
		expect(
			breadcrumb([
				{ name: "Anvils", item: "https://acme.example/anvils" },
				{ name: "Executive Anvil" },
			]),
		).toEqual({
			"@type": "BreadcrumbList",
			itemListElement: [
				{
					"@type": "ListItem",
					position: 1,
					name: "Anvils",
					item: "https://acme.example/anvils",
				},
				{ "@type": "ListItem", position: 2, name: "Executive Anvil" },
			],
		});
	});

	it("refuses a trail Google would not show", () => {
		expect(
			refusal(() =>
				breadcrumb([{ name: "Home", item: "https://acme.example/" }]),
			),
		).toMatchObject({
			code: "E_EPHEMERIS_MISSING_REQUIRED",
			property: "itemListElement",
		});
		expect(
			refusal(() =>
				breadcrumb([
					{ name: "Home" },
					{ name: "Anvils", item: "https://acme.example/anvils" },
				]),
			),
		).toMatchObject({ property: "itemListElement[0].item" });
		expect(
			refusal(() =>
				breadcrumb([
					{ name: " ", item: "https://acme.example/" },
					{ name: "B" },
				]),
			),
		).toMatchObject({
			property: "itemListElement[0].name",
		});
	});

	it("bounds the trail and its URLs", () => {
		const long = Array.from({ length: 33 }, (_, i) => ({
			name: `c${i}`,
			item: `https://acme.example/${i}`,
		}));
		expect(refusal(() => breadcrumb(long)).code).toBe("E_EPHEMERIS_TOO_MANY");
		expect(
			refusal(() =>
				breadcrumb([{ name: "A", item: "javascript:alert(1)" }, { name: "B" }]),
			).code,
		).toBe("E_EPHEMERIS_INVALID_URL");
	});
});

describe("ephemeris > bounds", () => {
	it("refuses text longer than any page shows", () => {
		const error = refusal(() =>
			person({
				"@type": "Person",
				description: "x".repeat(MAX_TEXT_LENGTH + 1),
			}),
		);
		expect(error.code).toBe("E_EPHEMERIS_TOO_LONG");
		expect(error.message).toMatch(/^person\.description is 10001 characters/);
	});

	it("refuses a URL that is not absolute http(s), at any depth", () => {
		const cases = [
			[
				() =>
					person({
						"@type": "Person",
						sameAs: ["https://a.example", "javascript:alert(1)"],
					}),
				/sameAs\[1\]/,
			],
			[
				() => person({ "@type": "Person", image: "/ada.jpg" }),
				/person\.image must be an absolute URL/,
			],
			[
				() =>
					person({
						"@type": "Person",
						worksFor: {
							"@type": "Organization",
							logo: "data:image/png;base64,AAAA",
						},
					}),
				/worksFor\.logo/,
			],
		] as const;
		for (const [build, message] of cases) {
			const error = refusal(build);
			expect(error.code).toBe("E_EPHEMERIS_INVALID_URL");
			expect(error.message).toMatch(message);
		}
	});

	it("refuses a node that is not a plain object", () => {
		class Page {
			readonly "@type" = "WebPage";
		}
		expect(refusal(() => webPage(new Page())).code).toBe(
			"E_EPHEMERIS_INVALID_NODE",
		);
	});
});

describe("ephemeris > helpers and the graph", () => {
	it("fill the graph's slots", () => {
		const silent = { onWarning: () => {} };
		const graph = new SchemaGraph({
			url: "https://acme.example/anvils/executive",
		})
			.identity(
				organization(
					{
						"@type": "Organization",
						name: "ACME",
						url: "https://acme.example/",
					},
					silent,
				),
			)
			.website(
				website(
					{ "@type": "WebSite", name: "ACME", url: "https://acme.example/" },
					silent,
				),
			)
			.webPage(webPage({ "@type": "WebPage", name: "Executive Anvil" }))
			.breadcrumb(
				breadcrumb([
					{ name: "Anvils", item: "https://acme.example/anvils" },
					{ name: "Executive Anvil" },
				]),
			)
			.toJsonLd();
		expect(graph["@graph"]).toHaveLength(4);
	});
});
