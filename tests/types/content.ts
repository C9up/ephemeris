/**
 * One complete node per content helper, as the docs and the schema.org
 * validator see them: `tsc --noEmit -p .` proves every property and type
 * exists in the vocabulary, since each helper takes the generated types.
 */

import {
	aggregateRating,
	article,
	course,
	event,
	jobPosting,
	merchantListing,
	product,
	recipe,
	review,
	softwareApplication,
	video,
} from "../../src/index.js";

const silent = { onWarning: () => {} };
const address = {
	"@type": "PostalAddress",
	streetAddress: "Rue du Lac 1268",
	addressLocality: "Biel",
	postalCode: "2501",
	addressCountry: "CH",
} as const;
const rating = {
	"@type": "AggregateRating",
	ratingValue: 4.4,
	reviewCount: 89,
	bestRating: 5,
	worstRating: 1,
} as const;
const nestedReview = {
	"@type": "Review",
	author: { "@type": "Person", name: "Ada" },
	datePublished: "2026-10-01",
	reviewRating: {
		"@type": "Rating",
		ratingValue: 5,
		bestRating: 5,
		worstRating: 1,
	},
} as const;

export const samples = {
	article: article(
		{
			"@type": "NewsArticle",
			headline: "Anvils are back",
			image: ["https://acme.example/a.jpg"],
			datePublished: "2026-10-13T08:00:00+02:00",
			dateModified: "2026-10-13T09:00:00+02:00",
			author: {
				"@type": "Person",
				name: "Ada",
				url: "https://acme.example/ada",
			},
		},
		silent,
	),
	product: product(
		{
			"@type": "Product",
			name: "Executive Anvil",
			aggregateRating: rating,
			review: nestedReview,
			offers: {
				"@type": "AggregateOffer",
				lowPrice: "99.00",
				highPrice: "149.00",
				priceCurrency: "CHF",
				offerCount: 3,
			},
		},
		silent,
	),
	merchantListing: merchantListing(
		{
			"@type": "Product",
			name: "Executive Anvil",
			image: "https://acme.example/anvil.jpg",
			description: "A heavy anvil",
			sku: "ANV-1",
			gtin13: "7612345678901",
			brand: { "@type": "Brand", name: "ACME" },
			offers: {
				"@type": "Offer",
				price: "119.95",
				priceCurrency: "CHF",
				availability: "https://schema.org/InStock",
				itemCondition: "https://schema.org/NewCondition",
				url: "https://acme.example/anvil",
				priceValidUntil: "2026-12-31",
			},
		},
		silent,
	),
	review: review(
		{
			...nestedReview,
			itemReviewed: { "@type": "Product", name: "Executive Anvil" },
		},
		silent,
	),
	aggregateRating: aggregateRating(
		{
			"@type": "AggregateRating",
			itemReviewed: { "@type": "LocalBusiness", name: "ACME Biel", address },
			ratingValue: 4.4,
			ratingCount: 120,
			bestRating: 5,
			worstRating: 1,
		},
		silent,
	),
	event: event(
		{
			"@type": "MusicEvent",
			name: "Anvil Chorus",
			startDate: "2026-11-02T20:00:00+01:00",
			endDate: "2026-11-02T22:00:00+01:00",
			eventStatus: "https://schema.org/EventScheduled",
			description: "Verdi",
			image: "https://acme.example/e.jpg",
			location: { "@type": "Place", name: "Hall", address },
			offers: {
				"@type": "Offer",
				price: 30,
				priceCurrency: "CHF",
				availability: "https://schema.org/InStock",
				validFrom: "2026-09-01T10:00:00+02:00",
				url: "https://acme.example/tickets",
			},
			organizer: {
				"@type": "Organization",
				name: "ACME",
				url: "https://acme.example/",
			},
			performer: { "@type": "PerformingGroup", name: "Choir" },
		},
		silent,
	),
	jobPosting: jobPosting(
		{
			"@type": "JobPosting",
			title: "Smith",
			description: "<p>Forge anvils.</p>",
			datePosted: "2026-10-01",
			validThrough: "2026-12-31T23:59:00+01:00",
			employmentType: "FULL_TIME",
			hiringOrganization: {
				"@type": "Organization",
				name: "ACME SA",
				sameAs: "https://acme.example/",
			},
			jobLocation: { "@type": "Place", address },
			baseSalary: {
				"@type": "MonetaryAmount",
				currency: "CHF",
				value: { "@type": "QuantitativeValue", value: 6500, unitText: "MONTH" },
			},
			identifier: { "@type": "PropertyValue", name: "ACME", value: "J-1" },
			directApply: true,
		},
		silent,
	),
	recipe: recipe(
		{
			"@type": "Recipe",
			name: "Rösti",
			image: "https://acme.example/r.jpg",
			description: "Grated potatoes",
			author: { "@type": "Person", name: "Ada" },
			datePublished: "2026-10-01",
			prepTime: "PT15M",
			cookTime: "PT20M",
			totalTime: "PT35M",
			recipeYield: "4",
			recipeCategory: "Main course",
			recipeCuisine: "Swiss",
			recipeIngredient: ["1 kg potatoes", "50 g butter"],
			recipeInstructions: [
				{ "@type": "HowToStep", text: "Grate the potatoes." },
			],
			keywords: "swiss, potatoes",
			nutrition: { "@type": "NutritionInformation", calories: "270 calories" },
			aggregateRating: rating,
		},
		silent,
	),
	video: video(
		{
			"@type": "VideoObject",
			name: "Forging",
			description: "How an anvil is made",
			thumbnailUrl: ["https://acme.example/t.jpg"],
			uploadDate: "2026-10-13T08:00:00Z",
			duration: "PT5M",
			contentUrl: "https://acme.example/v.mp4",
			embedUrl: "https://acme.example/embed/v",
			creator: { "@type": "Person", name: "Ada" },
		},
		silent,
	),
	softwareApplication: softwareApplication(
		{
			"@type": "SoftwareApplication",
			name: "Anvil",
			operatingSystem: "Android",
			applicationCategory: "BusinessApplication",
			offers: { "@type": "Offer", price: 0, priceCurrency: "CHF" },
			aggregateRating: rating,
		},
		silent,
	),
	course: course(
		{
			"@type": "Course",
			name: "Forging",
			description: "An introduction to forging anvils.",
			provider: {
				"@type": "Organization",
				name: "ACME",
				sameAs: "https://acme.example/",
			},
		},
		silent,
	),
};
