/**
 * One complete node per gallery helper: `tsc --noEmit -p .` proves every
 * property and type exists in the vocabulary; tests/unit/gallery.test.ts
 * runs them through the helpers.
 */

import {
	dataset,
	discussionForumPosting,
	employerAggregateRating,
	imageObject,
	itemList,
	mathSolver,
	memberProgram,
	merchantReturnPolicy,
	movie,
	productGroup,
	qaPage,
	quiz,
	shippingService,
	vacationRental,
} from "../../src/index.js";
import type { MathSolverLeaf } from "../../src/schema.js";

const silent = { onWarning: () => {} };
const ada = {
	"@type": "Person",
	name: "Ada",
	url: "https://acme.example/ada",
} as const;

// Google puts `mathExpression-input` on the action, where schema.org has no
// `mathExpression` (the vocabulary gives it to MathSolver): the action is
// written as data the generated types do not cover.
const solve = JSON.parse(
	'{"@type": "SolveMathAction", "target": "https://acme.example/solve?q={math_expression_string}", "eduQuestionType": "Polynomial Equation", "mathExpression-input": "required name=math_expression_string"}',
);
const solver: MathSolverLeaf = {
	"@type": "MathSolver",
	name: "ACME math",
	url: "https://acme.example/math",
	usageInfo: "https://acme.example/privacy",
	inLanguage: "en",
	learningResourceType: "Math solver",
	assesses: "Polynomial Equation",
	potentialAction: solve,
};

export const samples = {
	itemList: itemList(
		{
			"@type": "ItemList",
			itemListElement: [
				{
					"@type": "ListItem",
					position: 1,
					url: "https://acme.example/recipes/rosti",
				},
				{
					"@type": "ListItem",
					position: 2,
					url: "https://acme.example/recipes/fondue",
				},
			],
		},
		silent,
	),
	dataset: dataset(
		{
			"@type": "Dataset",
			name: "Anvil sales",
			description: "Monthly anvil sales in Switzerland, by canton, since 2001.",
			url: "https://acme.example/data/anvils",
			license: "https://creativecommons.org/licenses/by/4.0/",
			creator: { "@type": "Organization", name: "ACME" },
			distribution: {
				"@type": "DataDownload",
				encodingFormat: "text/csv",
				contentUrl: "https://acme.example/data/anvils.csv",
			},
		},
		silent,
	),
	discussionForumPosting: discussionForumPosting(
		{
			"@type": "DiscussionForumPosting",
			headline: "Which anvil for a beginner?",
			text: "I am starting out. Which anvil?",
			url: "https://acme.example/forum/1",
			author: ada,
			datePublished: "2026-10-01T09:00:00+02:00",
			comment: {
				"@type": "Comment",
				text: "A 50 kg one.",
				author: { "@type": "Person", name: "Bob" },
				datePublished: "2026-10-01T10:00:00+02:00",
			},
		},
		silent,
	),
	quiz: quiz(
		{
			"@type": "Quiz",
			about: { "@type": "Thing", name: "Metallurgy" },
			hasPart: {
				"@type": "Question",
				eduQuestionType: "Flashcard",
				text: "What is an anvil made of?",
				acceptedAnswer: { "@type": "Answer", text: "Forged steel" },
			},
		},
		silent,
	),
	employerAggregateRating: employerAggregateRating(
		{
			"@type": "EmployerAggregateRating",
			itemReviewed: { "@type": "Organization", name: "ACME SA" },
			ratingValue: 4.2,
			ratingCount: 120,
			bestRating: 5,
			worstRating: 1,
		},
		silent,
	),
	imageObject: imageObject(
		{
			"@type": "ImageObject",
			contentUrl: "https://acme.example/anvil.jpg",
			license: "https://acme.example/license",
			acquireLicensePage: "https://acme.example/buy",
			creditText: "ACME",
			creator: { "@type": "Person", name: "Ada" },
			copyrightNotice: "© ACME",
		},
		silent,
	),
	memberProgram: memberProgram(
		{
			"@type": "MemberProgram",
			name: "ACME Club",
			description: "Points on every anvil.",
			url: "https://acme.example/club",
			hasTiers: {
				"@type": "MemberProgramTier",
				name: "Silver",
				hasTierBenefit: "https://schema.org/TierBenefitLoyaltyPoints",
				url: "https://acme.example/club/silver",
			},
		},
		silent,
	),
	mathSolver: mathSolver(solver, silent),
	movie: movie(
		{
			"@type": "Movie",
			name: "The Anvil",
			image: "https://acme.example/anvil-movie.jpg",
			dateCreated: "2026-01-01",
			director: { "@type": "Person", name: "Ada" },
		},
		silent,
	),
	qaPage: qaPage(
		{
			"@type": "QAPage",
			mainEntity: {
				"@type": "Question",
				name: "Can an anvil rust?",
				text: "Mine has orange spots.",
				answerCount: 1,
				author: ada,
				datePublished: "2026-10-01",
				acceptedAnswer: {
					"@type": "Answer",
					text: "Yes; oil it.",
					author: { "@type": "Person", name: "Bob" },
					datePublished: "2026-10-02",
					upvoteCount: 3,
					url: "https://acme.example/qa/1#answer-1",
				},
			},
		},
		silent,
	),
	merchantReturnPolicy: merchantReturnPolicy(
		{
			"@type": "MerchantReturnPolicy",
			applicableCountry: "CH",
			returnPolicyCategory:
				"https://schema.org/MerchantReturnFiniteReturnWindow",
			merchantReturnDays: 30,
			merchantReturnLink: "https://acme.example/returns",
			returnMethod: "https://schema.org/ReturnByMail",
			returnFees: "https://schema.org/FreeReturn",
		},
		silent,
	),
	shippingService: shippingService(
		{
			"@type": "ShippingService",
			name: "Standard",
			description: "Two to four days.",
			shippingConditions: {
				"@type": "ShippingConditions",
				shippingDestination: { "@type": "DefinedRegion", addressCountry: "CH" },
				shippingRate: {
					"@type": "MonetaryAmount",
					value: 9.9,
					currency: "CHF",
				},
			},
		},
		silent,
	),
	vacationRental: vacationRental(
		{
			"@type": "VacationRental",
			name: "Chalet Anvil",
			identifier: "chalet-1",
			image: ["https://acme.example/chalet.jpg"],
			latitude: 46.54321,
			longitude: 7.98765,
			description: "A chalet",
			containsPlace: {
				"@type": "Accommodation",
				additionalType: "EntirePlace",
				occupancy: { "@type": "QuantitativeValue", value: 6 },
				numberOfBedrooms: 3,
			},
		},
		silent,
	),
	productGroup: productGroup(
		{
			"@type": "ProductGroup",
			name: "Executive Anvil",
			productGroupID: "ANV",
			variesBy: "https://schema.org/size",
			hasVariant: [
				{ "@type": "Product", name: "Executive Anvil, 50 kg", sku: "ANV-50" },
				{ "@type": "Product", name: "Executive Anvil, 100 kg", sku: "ANV-100" },
			],
		},
		silent,
	),
};
