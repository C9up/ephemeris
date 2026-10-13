import { afterEach, describe, expect, it } from "vitest";
import {
	aggregateRating,
	article,
	course,
	EphemerisError,
	event,
	jobPosting,
	merchantListing,
	product,
	type RequirementWarning,
	recipe,
	review,
	softwareApplication,
	stringifyJsonLd,
	video,
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

function warningsOf(
	build: (onWarning: (warning: RequirementWarning) => void) => unknown,
): RequirementWarning[] {
	const warnings: RequirementWarning[] = [];
	build((warning) => warnings.push(warning));
	return warnings;
}

const silent = { onWarning: () => {} };
const ADDRESS = {
	"@type": "PostalAddress",
	streetAddress: "Rue du Lac 1268",
	addressLocality: "Biel",
	postalCode: "2501",
	addressCountry: "CH",
} as const;
const RATING = {
	"@type": "AggregateRating",
	ratingValue: 4.4,
	reviewCount: 89,
} as const;

describe("ephemeris > article", () => {
	it("requires nothing, and recommends what Google lists", () => {
		const warnings = warningsOf((onWarning) =>
			article(
				{ "@type": "NewsArticle", headline: "Anvils are back" },
				{ onWarning },
			),
		);
		expect(warnings.map((w) => w.property)).toEqual([
			"image",
			"datePublished",
			"dateModified",
			"author",
		]);
	});

	it("warns of a date-time without a time zone, once per property kind", () => {
		const warnings = warningsOf((onWarning) =>
			article(
				{
					"@type": "BlogPosting",
					headline: "Anvils",
					image: "https://acme.example/a.jpg",
					datePublished: "2026-10-13T08:30:00",
					dateModified: "2026-10-13T09:00:00+02:00",
					author: {
						"@type": "Person",
						name: "Ada",
						url: "https://acme.example/ada",
					},
				},
				{ onWarning },
			),
		);
		expect(warnings).toEqual([
			expect.objectContaining({
				code: "W_EPHEMERIS_NO_TIMEZONE",
				type: "Article",
				property: "datePublished",
				source:
					"https://developers.google.com/search/docs/appearance/structured-data/article",
			}),
		]);
	});

	it.each([
		"2026-02-30",
		"13.10.2026",
		"2026-10-13T25:00:00Z",
		"2026-10-13 08:30",
	])("refuses %s as a date", (date) => {
		expect(
			refusal(() =>
				article({ "@type": "Article", datePublished: date }, silent),
			).code,
		).toBe("E_EPHEMERIS_INVALID_DATE");
	});
});

describe("ephemeris > product snippet", () => {
	it("requires a name, and a review, a rating or an offer", () => {
		expect(
			refusal(() => product({ "@type": "Product", review: [] }, silent)),
		).toMatchObject({
			property: "name",
		});
		expect(
			refusal(() => product({ "@type": "Product", name: "Anvil" }, silent)),
		).toMatchObject({
			property: "review or aggregateRating or offers",
		});
		expect(() =>
			product(
				{ "@type": "Product", name: "Anvil", aggregateRating: RATING },
				silent,
			),
		).not.toThrow();
	});

	it("checks each offer by its type: a price, or a range in a currency", () => {
		expect(
			refusal(() =>
				product(
					{
						"@type": "Product",
						name: "Anvil",
						offers: { "@type": "Offer", priceCurrency: "CHF" },
					},
					silent,
				),
			),
		).toMatchObject({
			type: "Offer",
			property: "price or priceSpecification.price",
		});
		expect(() =>
			product(
				{
					"@type": "Product",
					name: "Anvil",
					offers: {
						"@type": "Offer",
						priceSpecification: {
							"@type": "UnitPriceSpecification",
							price: 12,
						},
					},
				},
				silent,
			),
		).not.toThrow();
		expect(
			refusal(() =>
				product(
					{
						"@type": "Product",
						name: "Anvil",
						offers: { "@type": "AggregateOffer", lowPrice: 10 },
					},
					silent,
				),
			),
		).toMatchObject({ type: "AggregateOffer", property: "priceCurrency" });
	});

	it("checks nested reviews and ratings without asking what they review", () => {
		expect(
			refusal(() =>
				product(
					{
						"@type": "Product",
						name: "Anvil",
						review: {
							"@type": "Review",
							reviewRating: { "@type": "Rating", ratingValue: 5 },
						},
					},
					silent,
				),
			),
		).toMatchObject({ type: "Review", property: "author" });
		expect(
			refusal(() =>
				product(
					{
						"@type": "Product",
						name: "Anvil",
						aggregateRating: { "@type": "AggregateRating", ratingValue: 4 },
					},
					silent,
				),
			),
		).toMatchObject({
			type: "AggregateRating",
			property: "ratingCount or reviewCount",
		});
	});

	it.each([["CHF 12"], ["1,234.50"], ["12,50"], [-1], [Number.NaN]])(
		"refuses %s as a price, rather than guess",
		(price) => {
			const error = refusal(() =>
				product(
					{
						"@type": "Product",
						name: "Anvil",
						offers: { "@type": "Offer", price, priceCurrency: "CHF" },
					},
					silent,
				),
			);
			expect(error.code).toBe("E_EPHEMERIS_INVALID_PRICE");
		},
	);

	it("takes a price as a number or as decimal digits", () => {
		for (const price of [12, 12.5, "12", "1234.50"]) {
			expect(() =>
				product(
					{
						"@type": "Product",
						name: "Anvil",
						offers: { "@type": "Offer", price, priceCurrency: "CHF" },
					},
					silent,
				),
			).not.toThrow();
		}
	});

	it.each(["chf", "CH", "Swiss francs", "€", "XYZ", "XXX", "XTS"])(
		"refuses %s as a currency",
		(currency) => {
			expect(
				refusal(() =>
					product(
						{
							"@type": "Product",
							name: "Anvil",
							offers: { "@type": "Offer", price: 12, priceCurrency: currency },
						},
						silent,
					),
				).code,
			).toBe("E_EPHEMERIS_INVALID_CURRENCY");
		},
	);
});

describe("ephemeris > merchant listing", () => {
	const anvil = {
		"@type": "Product",
		name: "Executive Anvil",
		image: "https://acme.example/anvil.jpg",
	} as const;

	it("requires an image and an offer priced in a currency", () => {
		expect(
			refusal(() =>
				merchantListing(
					{
						"@type": "Product",
						name: "A",
						offers: { "@type": "Offer", price: 1, priceCurrency: "CHF" },
					},
					silent,
				),
			),
		).toMatchObject({ property: "image" });
		expect(
			refusal(() =>
				merchantListing(
					{ ...anvil, offers: { "@type": "Offer", price: 119 } },
					silent,
				),
			),
		).toMatchObject({
			type: "Offer",
			property: "priceCurrency or priceSpecification.priceCurrency",
		});
	});

	it("refuses an AggregateOffer: the page is the seller", () => {
		expect(
			refusal(() =>
				merchantListing(
					{
						...anvil,
						offers: {
							"@type": "AggregateOffer",
							lowPrice: 1,
							priceCurrency: "CHF",
						},
					},
					silent,
				),
			),
		).toMatchObject({ property: "offers" });
	});

	it("has nothing to say about a complete listing", () => {
		const warnings = warningsOf((onWarning) =>
			merchantListing(
				{
					...anvil,
					description: "A heavy anvil",
					sku: "ANV-1",
					mpn: "A-1",
					gtin13: "7612345678901",
					brand: { "@type": "Brand", name: "ACME" },
					category: "Tools",
					aggregateRating: { ...RATING, bestRating: 5, worstRating: 1 },
					review: {
						"@type": "Review",
						author: { "@type": "Person", name: "Ada" },
						datePublished: "2026-10-01",
						reviewRating: {
							"@type": "Rating",
							ratingValue: 5,
							bestRating: 5,
							worstRating: 1,
						},
					},
					offers: {
						"@type": "Offer",
						price: "119.95",
						priceCurrency: "CHF",
						availability: "InStock",
						itemCondition: "NewCondition",
						url: "https://acme.example/anvil",
						priceValidUntil: "2026-12-31",
						shippingDetails: { "@id": "https://acme.example/#shipping" },
						hasMerchantReturnPolicy: { "@id": "https://acme.example/#returns" },
					},
				},
				{ onWarning },
			),
		);
		expect(warnings.map((w) => `${w.type}.${w.property}`)).toEqual([]);
	});
});

describe("ephemeris > reviews and ratings on their own", () => {
	it("name what they review", () => {
		const reviewRating = { "@type": "Rating", ratingValue: 4 } as const;
		expect(
			refusal(() =>
				review({ "@type": "Review", author: "Ada", reviewRating }, silent),
			),
		).toMatchObject({
			property: "itemReviewed",
		});
		expect(
			refusal(() =>
				review(
					{
						"@type": "Review",
						author: "Ada",
						reviewRating,
						itemReviewed: { "@type": "Product" },
					},
					silent,
				),
			),
		).toMatchObject({ property: "itemReviewed.name" });
		expect(
			refusal(() =>
				aggregateRating(
					{ "@type": "AggregateRating", ratingValue: 4, ratingCount: 3 },
					silent,
				),
			),
		).toMatchObject({ property: "itemReviewed" });
	});

	it("warns of an author's name Google will not take", () => {
		const warnings = warningsOf((onWarning) =>
			review(
				{
					"@type": "Review",
					author: "A".repeat(100),
					itemReviewed: { "@type": "Product", name: "Anvil" },
					reviewRating: { "@type": "Rating", ratingValue: 4 },
				},
				{ onWarning },
			),
		);
		expect(warnings.map((w) => w.code)).toContain(
			"W_EPHEMERIS_TOO_LONG_FOR_GOOGLE",
		);
	});
});

describe("ephemeris > event", () => {
	it("requires where it happens, at an address", () => {
		expect(
			refusal(() =>
				event(
					{
						"@type": "Event",
						name: "Anvil fair",
						startDate: "2026-11-02T10:00+01:00",
						location: { "@type": "Place", name: "Hall" },
					},
					silent,
				),
			),
		).toMatchObject({ property: "location.address" });
	});

	it("recommends what Google lists about its offers, when it has some", () => {
		const warnings = warningsOf((onWarning) =>
			event(
				{
					"@type": "MusicEvent",
					name: "Anvil Chorus",
					startDate: "2026-11-02T20:00:00+01:00",
					location: { "@type": "Place", name: "Hall", address: ADDRESS },
					offers: { "@type": "Offer", price: 30, priceCurrency: "CHF" },
				},
				{ onWarning },
			),
		).map((w) => w.property);
		expect(warnings).toContain("offers.availability");
		expect(warnings).not.toContain("offers.price");
	});
});

describe("ephemeris > job posting", () => {
	const job = {
		"@type": "JobPosting",
		title: "Smith",
		description: "<p>Forge anvils.</p>",
		datePosted: "2026-10-01",
		hiringOrganization: { "@type": "Organization", name: "ACME SA" },
	} as const;

	it("requires a workplace for a job on site", () => {
		expect(refusal(() => jobPosting(job, silent))).toMatchObject({
			property: "jobLocation",
		});
		expect(() =>
			jobPosting(
				{ ...job, jobLocation: { "@type": "Place", address: ADDRESS } },
				silent,
			),
		).not.toThrow();
	});

	it("requires the countries applicants may work from for a fully remote job", () => {
		expect(
			refusal(() =>
				jobPosting({ ...job, jobLocationType: "TELECOMMUTE" }, silent),
			),
		).toMatchObject({
			property: "applicantLocationRequirements or jobLocation",
		});
		expect(() =>
			jobPosting(
				{
					...job,
					jobLocationType: "TELECOMMUTE",
					applicantLocationRequirements: { "@type": "Country", name: "CH" },
				},
				silent,
			),
		).not.toThrow();
	});
});

describe("ephemeris > recipe, video, app, course", () => {
	it("requires a recipe's image, and its yield when calories are given", () => {
		expect(
			refusal(() => recipe({ "@type": "Recipe", name: "Rösti" }, silent)),
		).toMatchObject({ property: "image" });
		expect(
			refusal(() =>
				recipe(
					{
						"@type": "Recipe",
						name: "Rösti",
						image: "https://acme.example/rosti.jpg",
						nutrition: {
							"@type": "NutritionInformation",
							calories: "270 calories",
						},
					},
					silent,
				),
			),
		).toMatchObject({ property: "recipeYield" });
	});

	it("requires a video's thumbnail and upload date, and takes an author for a creator", () => {
		expect(
			refusal(() => video({ "@type": "VideoObject", name: "Forging" }, silent)),
		).toMatchObject({
			property: "thumbnailUrl",
		});
		const warnings = warningsOf((onWarning) =>
			video(
				{
					"@type": "VideoObject",
					name: "Forging",
					thumbnailUrl: "https://acme.example/t.jpg",
					uploadDate: "2026-10-13T08:00:00Z",
					author: { "@type": "Person", name: "Ada" },
				},
				{ onWarning },
			),
		).map((w) => w.property);
		expect(warnings).not.toContain("creator or author");
	});

	it("requires an app's price, and a rating or a review", () => {
		expect(
			refusal(() =>
				softwareApplication(
					{
						"@type": "SoftwareApplication",
						name: "Anvil",
						offers: { "@type": "Offer", priceCurrency: "CHF" },
						aggregateRating: RATING,
					},
					silent,
				),
			),
		).toMatchObject({ property: "offers.price" });
		expect(
			refusal(() =>
				softwareApplication(
					{
						"@type": "MobileApplication",
						name: "Anvil",
						offers: { "@type": "Offer", price: 0 },
					},
					silent,
				),
			),
		).toMatchObject({ property: "aggregateRating or review" });
	});

	it("warns of a course description longer than Google shows", () => {
		const warnings = warningsOf((onWarning) =>
			course(
				{
					"@type": "Course",
					name: "Forging",
					description:
						"An introduction to forging anvils, hammers and the patience they take.",
					provider: { "@type": "Organization", name: "ACME" },
				},
				{ onWarning },
			),
		);
		expect(warnings.map((w) => w.code)).toEqual([
			"W_EPHEMERIS_TOO_LONG_FOR_GOOGLE",
		]);
	});
});

describe("ephemeris > the complete samples", () => {
	it("build, and serialize, for every content helper", async () => {
		const { samples } = await import("../types/content.js");
		expect(Object.keys(samples)).toHaveLength(11);
		for (const node of Object.values(samples)) {
			expect(JSON.parse(stringifyJsonLd(node))).toEqual(node);
		}
	});
});

describe("ephemeris > shapes a database may send", () => {
	it("checks only what has the shape a check reads", () => {
		// Shapes the generated types refuse, but a row can hold.
		const odd = JSON.parse(
			'{"author": 42, "description": {"@value": "Forging"}, "nutrition": "light"}',
		);
		const reviewRating = { "@type": "Rating", ratingValue: 4 } as const;
		const itemReviewed = { "@type": "Thing", name: "A" } as const;
		expect(() =>
			review(
				{ "@type": "Review", itemReviewed, reviewRating, author: odd.author },
				silent,
			),
		).not.toThrow();
		expect(() =>
			review(
				{
					"@type": "Review",
					itemReviewed,
					reviewRating,
					author: { "@type": "Person" },
				},
				silent,
			),
		).not.toThrow();
		expect(() =>
			course(
				{ "@type": "Course", name: "Forging", description: odd.description },
				silent,
			),
		).not.toThrow();
		const image = "https://acme.example/r.jpg";
		expect(() =>
			recipe(
				{ "@type": "Recipe", name: "Rösti", image, nutrition: odd.nutrition },
				silent,
			),
		).not.toThrow();
		expect(() =>
			recipe(
				{
					"@type": "Recipe",
					name: "Rösti",
					image,
					nutrition: { "@type": "NutritionInformation", fatContent: "12 g" },
				},
				silent,
			),
		).not.toThrow();
	});
});

describe("ephemeris > dates and the machine's time zone", () => {
	const original = process.env.TZ;
	afterEach(() => {
		if (original === undefined) delete process.env.TZ;
		else process.env.TZ = original;
	});

	it("writes a Date the same way whatever the machine's zone", () => {
		const published = new Date(Date.UTC(2026, 9, 13, 23, 30));
		const render = () =>
			stringifyJsonLd({
				"@type": "Article",
				headline: "A",
				datePublished: published,
			});
		process.env.TZ = "America/Los_Angeles";
		const west = render();
		process.env.TZ = "Asia/Tokyo";
		const east = render();
		expect(west).toBe(east);
		expect(west).toContain('"datePublished":"2026-10-13T23:30:00.000Z"');
	});
});
