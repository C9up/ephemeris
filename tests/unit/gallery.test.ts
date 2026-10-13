import { describe, expect, it } from "vitest";
import {
	article,
	dataset,
	discussionForumPosting,
	EphemerisError,
	employerAggregateRating,
	imageObject,
	itemList,
	merchantListing,
	merchantReturnPolicy,
	movie,
	organization,
	qaPage,
	quiz,
	type RequirementWarning,
	shippingService,
	stringifyJsonLd,
	vacationRental,
	webPage,
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

const silent = { onWarning: () => {} };

describe("ephemeris > the gallery samples", () => {
	it("build, and serialize, for every gallery helper", async () => {
		const { samples } = await import("../types/gallery.js");
		expect(Object.keys(samples)).toHaveLength(14);
		for (const node of Object.values(samples)) {
			expect(JSON.parse(stringifyJsonLd(node))).toEqual(node);
		}
	});
});

describe("ephemeris > carousels and datasets", () => {
	it("takes a list of URLs or of items, each positioned", () => {
		expect(
			refusal(() =>
				itemList(
					{
						"@type": "ItemList",
						itemListElement: [
							{ "@type": "ListItem", url: "https://a.example/1" },
						],
					},
					silent,
				),
			),
		).toMatchObject({ property: "itemListElement.position" });
		expect(
			refusal(() =>
				itemList(
					{
						"@type": "ItemList",
						itemListElement: [{ "@type": "ListItem", position: 1 }],
					},
					silent,
				),
			),
		).toMatchObject({
			property: "itemListElement.url or itemListElement.item",
		});
		expect(
			refusal(() =>
				itemList(
					{
						"@type": "ItemList",
						itemListElement: [
							{
								"@type": "ListItem",
								position: 1,
								item: { "@type": "Recipe", name: "Rösti" },
							},
						],
					},
					silent,
				),
			),
		).toMatchObject({ property: "itemListElement.item.url" });
	});

	it("requires a dataset's download URL when it has a distribution", () => {
		expect(
			refusal(() =>
				dataset(
					{
						"@type": "Dataset",
						name: "A",
						description: "B",
						distribution: {
							"@type": "DataDownload",
							encodingFormat: "text/csv",
						},
					},
					silent,
				),
			),
		).toMatchObject({ property: "distribution.contentUrl" });
	});
});

describe("ephemeris > forums and Q&A", () => {
	/** A post that says nothing yet. */
	const untold = {
		"@type": "DiscussionForumPosting",
		author: { "@type": "Person", name: "Ada" },
		datePublished: "2026-10-01T09:00:00+02:00",
	} as const;
	const post = { ...untold, text: "Hello" } as const;

	it("requires what a post says, as text, image or video", () => {
		expect(refusal(() => discussionForumPosting(untold, silent))).toMatchObject(
			{
				property: "text or image or video",
			},
		);
		expect(() =>
			discussionForumPosting(
				{ ...untold, image: "https://a.example/i.jpg" },
				silent,
			),
		).not.toThrow();
	});

	it("checks comments at every depth", () => {
		expect(
			refusal(() =>
				discussionForumPosting(
					{
						...post,
						comment: {
							"@type": "Comment",
							text: "first",
							author: { "@type": "Person", name: "Bob" },
							datePublished: "2026-10-01T10:00:00+02:00",
							comment: {
								"@type": "Comment",
								text: "nested",
								author: { "@type": "Person", name: "Cy" },
							},
						},
					},
					silent,
				),
			),
		).toMatchObject({ type: "Comment", property: "datePublished" });
	});

	it("stops at the depth any document stops at", () => {
		let comment: Record<string, unknown> = { "@type": "Comment" };
		for (let i = 0; i < 70; i++) {
			comment = {
				"@type": "Comment",
				text: `reply ${i}`,
				author: { "@type": "Person", name: "Ada" },
				datePublished: "2026-10-01",
				comment,
			};
		}
		// The innermost comment, past 64 levels, is not reached.
		expect(() =>
			discussionForumPosting(
				{ ...post, comment: JSON.parse(JSON.stringify(comment)) },
				silent,
			),
		).not.toThrow();
	});

	it("checks a Q&A page's question and its answers", () => {
		const question = {
			"@type": "Question",
			name: "Rust?",
			answerCount: 1,
		} as const;
		expect(
			refusal(() =>
				qaPage({ "@type": "QAPage", mainEntity: question }, silent),
			),
		).toMatchObject({
			type: "Question",
			property: "acceptedAnswer or suggestedAnswer",
		});
		expect(
			refusal(() =>
				qaPage(
					{
						"@type": "QAPage",
						mainEntity: {
							...question,
							suggestedAnswer: { "@type": "Answer", upvoteCount: 1 },
						},
					},
					silent,
				),
			),
		).toMatchObject({ type: "Answer", property: "text" });
	});

	it("requires each quiz question's answer and format", () => {
		expect(
			refusal(() =>
				quiz(
					{
						"@type": "Quiz",
						hasPart: {
							"@type": "Question",
							text: "Q?",
							eduQuestionType: "Flashcard",
						},
					},
					silent,
				),
			),
		).toMatchObject({ property: "hasPart.acceptedAnswer" });
	});
});

describe("ephemeris > ratings, images, movies, rentals", () => {
	it("requires an employer rating's counts", () => {
		expect(
			refusal(() =>
				employerAggregateRating(
					{
						"@type": "EmployerAggregateRating",
						itemReviewed: { "@type": "Organization", name: "A" },
						ratingValue: 4,
					},
					silent,
				),
			),
		).toMatchObject({ property: "ratingCount or reviewCount" });
	});

	it("requires an image's URL, and who holds it or how it is licensed", () => {
		expect(
			refusal(() =>
				imageObject(
					{ "@type": "ImageObject", contentUrl: "https://a.example/i.jpg" },
					silent,
				),
			),
		).toMatchObject({
			property: "creator or creditText or copyrightNotice or license",
		});
		expect(() =>
			imageObject(
				{
					"@type": "ImageObject",
					url: "https://a.example/i.jpg",
					creditText: "ACME",
				},
				silent,
			),
		).not.toThrow();
	});

	it("requires a movie's image, and a rental's occupancy", () => {
		expect(
			refusal(() => movie({ "@type": "Movie", name: "A" }, silent)),
		).toMatchObject({ property: "image" });
		expect(
			refusal(() =>
				vacationRental(
					{
						"@type": "VacationRental",
						name: "Chalet",
						identifier: "c1",
						image: "https://a.example/c.jpg",
						latitude: 46.5,
						longitude: 7.9,
						containsPlace: {
							"@type": "Accommodation",
							occupancy: { "@type": "QuantitativeValue" },
						},
					},
					silent,
				),
			),
		).toMatchObject({ property: "containsPlace.occupancy.value" });
	});
});

describe("ephemeris > return and shipping policies", () => {
	const policy = {
		"@type": "MerchantReturnPolicy",
		applicableCountry: "CH",
		merchantReturnLink: "https://a.example/returns",
	} as const;

	it("requires the days of a finite window, and the amount of a return fee", () => {
		expect(
			refusal(() =>
				merchantReturnPolicy(
					{
						...policy,
						returnPolicyCategory: "MerchantReturnFiniteReturnWindow",
					},
					silent,
				),
			),
		).toMatchObject({ property: "merchantReturnDays" });
		expect(
			refusal(() =>
				merchantReturnPolicy(
					{
						...policy,
						returnPolicyCategory:
							"https://schema.org/MerchantReturnUnlimitedWindow",
						returnFees: "ReturnShippingFees",
					},
					silent,
				),
			),
		).toMatchObject({ property: "returnShippingFeesAmount" });
		expect(() =>
			merchantReturnPolicy(
				{ ...policy, returnPolicyCategory: "MerchantReturnNotPermitted" },
				silent,
			),
		).not.toThrow();
	});

	it("requires a shipping rate's currency and amount", () => {
		expect(
			refusal(() =>
				shippingService(
					{
						"@type": "ShippingService",
						shippingConditions: {
							"@type": "ShippingConditions",
							shippingDestination: {
								"@type": "DefinedRegion",
								addressCountry: "CH",
							},
							shippingRate: { "@type": "MonetaryAmount", currency: "CHF" },
						},
					},
					silent,
				),
			),
		).toMatchObject({
			property:
				"shippingConditions.shippingRate.value or shippingConditions.shippingRate.maxValue",
		});
	});

	it("checks the policies an organization and a merchant's offer carry", () => {
		expect(() =>
			organization(
				{
					"@type": "Organization",
					name: "ACME",
					hasShippingService: {
						"@type": "ShippingService",
						shippingConditions: {
							"@type": "ShippingConditions",
							shippingDestination: {
								"@type": "DefinedRegion",
								addressCountry: "CH",
							},
							shippingRate: {
								"@type": "MonetaryAmount",
								value: 0,
								currency: "CHF",
							},
						},
					},
					hasMemberProgram: {
						"@type": "MemberProgram",
						name: "Club",
						description: "Points",
						hasTiers: {
							"@type": "MemberProgramTier",
							name: "Silver",
							hasTierBenefit: "https://schema.org/TierBenefitLoyaltyPoints",
						},
					},
				},
				silent,
			),
		).not.toThrow();
		expect(
			refusal(() =>
				organization(
					{
						"@type": "Organization",
						name: "ACME",
						hasMerchantReturnPolicy: {
							"@type": "MerchantReturnPolicy",
							applicableCountry: "CH",
						},
					},
					silent,
				),
			),
		).toMatchObject({
			type: "MerchantReturnPolicy",
			property: "returnPolicyCategory",
		});
		expect(
			refusal(() =>
				merchantListing(
					{
						"@type": "Product",
						name: "Anvil",
						image: "https://a.example/a.jpg",
						offers: {
							"@type": "Offer",
							price: 1,
							priceCurrency: "CHF",
							shippingDetails: {
								"@type": "OfferShippingDetails",
								shippingDestination: {
									"@type": "DefinedRegion",
									addressCountry: "CH",
								},
							},
						},
					},
					silent,
				),
			),
		).toMatchObject({ type: "OfferShippingDetails", property: "deliveryTime" });
	});
});

describe("ephemeris > speakable and paywalled content", () => {
	it("requires a speakable section's selector", () => {
		expect(
			refusal(() =>
				article(
					{
						"@type": "Article",
						headline: "A",
						speakable: { "@type": "SpeakableSpecification" },
					},
					silent,
				),
			),
		).toMatchObject({ property: "cssSelector or xpath" });
		expect(() =>
			webPage({
				"@type": "WebPage",
				speakable: {
					"@type": "SpeakableSpecification",
					xpath: "/html/head/title",
				},
			}),
		).not.toThrow();
	});

	it("warns of paywalled content without its section", () => {
		const warnings: RequirementWarning[] = [];
		const onWarning = (warning: RequirementWarning) => warnings.push(warning);
		webPage({ "@type": "WebPage", isAccessibleForFree: false }, { onWarning });
		article(
			{ "@type": "NewsArticle", headline: "A", isAccessibleForFree: "False" },
			{ onWarning },
		);
		article(
			{
				"@type": "NewsArticle",
				headline: "B",
				isAccessibleForFree: false,
				hasPart: {
					"@type": "WebPageElement",
					isAccessibleForFree: false,
					cssSelector: ".paywall",
				},
			},
			{ onWarning },
		);
		expect(
			warnings.filter((w) => w.property === "hasPart.cssSelector"),
		).toHaveLength(2);
	});
});
