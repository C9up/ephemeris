/**
 * The rest of Google's search gallery: carousels, datasets, forums, quizzes,
 * employer ratings, image licenses, loyalty programs, math solvers, movies,
 * Q&A pages, return and shipping policies, vacation rentals and product
 * groups — each rule read from its Search Central page, with the page's date.
 *
 * Left out, with Google's reason: fact checks (ClaimReview), whose support
 * Google is phasing out; and book actions, which come from a feed of
 * onboarded providers, not from a page's markup.
 */

import { build, checkNested } from "./build.js";
import { type Data, isPlainObject } from "./data.js";
import {
	type CheckOptions,
	check,
	isEmpty,
	type Reporter,
	type Rule,
} from "./requirements.js";
import type {
	Dataset,
	DiscussionForumPosting,
	EmployerAggregateRating,
	ImageObject,
	ItemList,
	MathSolver,
	MemberProgram,
	MerchantReturnPolicy,
	Movie,
	ProductGroup,
	QAPage,
	Quiz,
	ShippingService,
	VacationRental,
} from "./schema.js";

const PAGES =
	"https://developers.google.com/search/docs/appearance/structured-data";

type NodeOf<T> = Exclude<T, string>;

/** Whether `value`, or one of its items, is the schema.org member `name`. */
function names(value: unknown, name: string): boolean {
	return [value]
		.flat()
		.some((item) => item === name || item === `https://schema.org/${name}`);
}

/** A carousel: a summary page's list of URLs, or an all-in-one page's items. */
export const ITEM_LIST: Rule = {
	type: "ItemList",
	source: `${PAGES}/carousel`,
	read: "2026-09-08",
	required: [
		"itemListElement",
		"itemListElement.position",
		["itemListElement.url", "itemListElement.item"],
		"itemListElement.item.name",
		"itemListElement.item.url",
	],
};

export const DATASET: Rule = {
	type: "Dataset",
	source: `${PAGES}/dataset`,
	read: "2026-09-08",
	required: ["name", "description", "distribution.contentUrl"],
	recommended: [
		"url",
		"sameAs",
		"identifier",
		"keywords",
		"license",
		"creator",
		"version",
		"isAccessibleForFree",
		"temporalCoverage",
		"spatialCoverage",
		"variableMeasured",
		"includedInDataCatalog",
		"distribution",
		"distribution.encodingFormat",
	],
};

/** A forum post, or a comment on one: an author, a date, and what it says. */
export const DISCUSSION_FORUM_POSTING: Rule = {
	type: "DiscussionForumPosting",
	source: `${PAGES}/discussion-forum`,
	read: "2026-09-08",
	required: [
		"author",
		"author.name",
		"datePublished",
		["text", "image", "video"],
	],
	recommended: [
		"author.url",
		"headline",
		"url",
		"dateModified",
		"commentCount",
		"interactionStatistic",
	],
};

export const COMMENT: Rule = {
	type: "Comment",
	source: `${PAGES}/discussion-forum`,
	read: "2026-09-08",
	required: ["author", "datePublished", ["text", "image", "video"]],
	recommended: ["author.url", "url", "dateModified"],
};

/** An education Q&A quiz: its questions, each with an accepted answer. */
export const QUIZ: Rule = {
	type: "Quiz",
	source: `${PAGES}/education-qa`,
	read: "2026-09-08",
	required: [
		"hasPart",
		"hasPart.acceptedAnswer",
		"hasPart.eduQuestionType",
		"hasPart.text",
	],
	recommended: [
		"about",
		"about.name",
		"educationalAlignment",
		"educationalAlignment.alignmentType",
		"educationalAlignment.targetName",
	],
};

/** The rating employees give an organization. */
export const EMPLOYER_AGGREGATE_RATING: Rule = {
	type: "EmployerAggregateRating",
	source: `${PAGES}/employer-rating`,
	read: "2026-09-08",
	required: ["itemReviewed", "ratingValue", ["ratingCount", "reviewCount"]],
	recommended: ["bestRating", "worstRating"],
};

/** An image's license metadata: the image, and who holds it or how to license it. */
export const IMAGE_LICENSE: Rule = {
	type: "ImageObject",
	source: `${PAGES}/image-license-metadata`,
	read: "2025-12-10",
	required: [
		["contentUrl", "url"],
		["creator", "creditText", "copyrightNotice", "license"],
	],
	recommended: [
		"license",
		"acquireLicensePage",
		"creditText",
		"copyrightNotice",
		"creator",
		"creator.name",
	],
};

/** A loyalty program: its tiers, each with its benefits. */
export const MEMBER_PROGRAM: Rule = {
	type: "MemberProgram",
	source: `${PAGES}/loyalty-program`,
	read: "2026-09-08",
	required: [
		"name",
		"description",
		"hasTiers",
		"hasTiers.name",
		"hasTiers.hasTierBenefit",
	],
	recommended: ["url", "hasTiers.hasTierRequirement", "hasTiers.url"],
};

/** A math solver: the action that takes an expression, and the resource type. */
export const MATH_SOLVER: Rule = {
	type: "MathSolver",
	source: `${PAGES}/math-solvers`,
	read: "2025-12-18",
	required: [
		"url",
		"usageInfo",
		"learningResourceType",
		"potentialAction",
		"potentialAction.target",
		"potentialAction.mathExpression-input",
	],
	recommended: ["inLanguage", "assesses", "potentialAction.eduQuestionType"],
};

/** A movie in a carousel (shown on mobile). */
export const MOVIE: Rule = {
	type: "Movie",
	source: `${PAGES}/movie`,
	read: "2026-09-08",
	required: ["name", "image"],
	recommended: ["dateCreated", "director", "aggregateRating", "review"],
};

/** A Q&A page: one question, its answers. */
export const QA_PAGE: Rule = {
	type: "QAPage",
	source: `${PAGES}/qapage`,
	read: "2026-09-08",
	required: ["mainEntity"],
};

export const QUESTION: Rule = {
	type: "Question",
	source: `${PAGES}/qapage`,
	read: "2026-09-08",
	required: ["name", "answerCount", ["acceptedAnswer", "suggestedAnswer"]],
	recommended: [
		"text",
		"author",
		"author.url",
		"datePublished",
		"dateModified",
		"upvoteCount",
	],
};

export const ANSWER: Rule = {
	type: "Answer",
	source: `${PAGES}/qapage`,
	read: "2026-09-08",
	required: ["text"],
	recommended: ["author", "author.url", "datePublished", "upvoteCount", "url"],
};

/**
 * A return policy. A finite return window needs its number of days; a fee to
 * ship the return needs its amount.
 */
export const MERCHANT_RETURN_POLICY: Rule = {
	type: "MerchantReturnPolicy",
	source: `${PAGES}/return-policy`,
	read: "2026-09-08",
	required: ["applicableCountry", "returnPolicyCategory", "merchantReturnLink"],
	recommended: ["returnFees", "returnMethod"],
	checks: [
		(node, report) => {
			if (
				names(node.returnPolicyCategory, "MerchantReturnFiniteReturnWindow") &&
				isEmpty(node.merchantReturnDays)
			) {
				report.fail("merchantReturnDays", " for a finite return window");
			}
			if (
				names(node.returnFees, "ReturnShippingFees") &&
				isEmpty(node.returnShippingFeesAmount)
			) {
				report.fail(
					"returnShippingFeesAmount",
					" when the return costs a shipping fee",
				);
			}
		},
	],
};

/** A shipping policy: its conditions — where, at what rate, how fast. */
export const SHIPPING_SERVICE: Rule = {
	type: "ShippingService",
	source: `${PAGES}/shipping-policy`,
	read: "2026-09-08",
	required: [
		"shippingConditions",
		"shippingConditions.shippingDestination.addressCountry",
		"shippingConditions.shippingRate.currency",
		[
			"shippingConditions.shippingRate.value",
			"shippingConditions.shippingRate.maxValue",
		],
	],
	recommended: ["name", "description", "handlingTime"],
};

/** An offer's shipping (merchant listing). */
export const OFFER_SHIPPING_DETAILS: Rule = {
	type: "OfferShippingDetails",
	source: `${PAGES}/merchant-listing`,
	read: "2026-09-08",
	required: [
		"deliveryTime",
		"shippingDestination",
		"shippingDestination.addressCountry",
		"shippingRate",
		"shippingRate.currency",
		["shippingRate.value", "shippingRate.maxValue"],
	],
};

/** A vacation rental (sites that meet Google's eligibility criteria). */
export const VACATION_RENTAL: Rule = {
	type: "VacationRental",
	source: `${PAGES}/vacation-rental`,
	read: "2026-09-08",
	required: [
		"name",
		"identifier",
		"image",
		"latitude",
		"longitude",
		"containsPlace",
		"containsPlace.occupancy",
		"containsPlace.occupancy.value",
	],
	recommended: [
		"description",
		"address",
		"aggregateRating",
		"review",
		"brand",
		"checkinTime",
		"checkoutTime",
		"knowsLanguage",
		"containsPlace.numberOfBedrooms",
		"containsPlace.numberOfBathroomsTotal",
		"containsPlace.amenityFeature",
	],
};

/** A product's variants, grouped. */
export const PRODUCT_GROUP: Rule = {
	type: "ProductGroup",
	source: `${PAGES}/product-variants`,
	read: "2026-09-08",
	required: ["name"],
	recommended: [
		"description",
		"url",
		"brand",
		"brand.name",
		"productGroupID",
		"variesBy",
		"hasVariant",
		"aggregateRating",
		"review",
	],
};

/** Speakable sections of an article or a page (beta): by CSS selector or XPath. */
export const SPEAKABLE: Rule = {
	type: "SpeakableSpecification",
	source: `${PAGES}/speakable`,
	read: "2026-09-08",
	required: [["cssSelector", "xpath"]],
};

/**
 * Content behind a paywall: `isAccessibleForFree: false`, and the paywalled
 * sections named by `hasPart` with their CSS selector.
 */
export function paywall(node: Data, report: Reporter): void {
	if (
		node.isAccessibleForFree !== false &&
		!names(node.isAccessibleForFree, "False")
	) {
		return;
	}
	const parts = [node.hasPart]
		.flat()
		.filter(isPlainObject)
		.filter((part) => typeof part.cssSelector === "string");
	if (parts.length === 0) {
		report.warn(
			"W_EPHEMERIS_MISSING_RECOMMENDED",
			"hasPart.cssSelector",
			"paywalled content has no hasPart naming its section by cssSelector",
		);
	}
}

/**
 * Comments, at any depth of a thread. The depth is bounded before this runs:
 * `build` refuses data nested deeper than 64 levels.
 */
function checkComments(node: object, options: CheckOptions): void {
	for (const comment of [Reflect.get(node, "comment")].flat()) {
		if (isPlainObject(comment)) {
			check(COMMENT, comment, options);
			checkComments(comment, options);
		}
	}
}

export function itemList<T extends NodeOf<ItemList>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "itemList", ITEM_LIST, options);
}

export function dataset<T extends NodeOf<Dataset>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "dataset", DATASET, options);
}

/** A forum post; its comments, at every depth, are checked too. */
export function discussionForumPosting<
	T extends NodeOf<DiscussionForumPosting>,
>(node: T, options: CheckOptions = {}): T {
	const built = build(
		node,
		"discussionForumPosting",
		DISCUSSION_FORUM_POSTING,
		options,
	);
	checkComments(built, options);
	return built;
}

export function quiz<T extends NodeOf<Quiz>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "quiz", QUIZ, options);
}

export function employerAggregateRating<
	T extends NodeOf<EmployerAggregateRating>,
>(node: T, options: CheckOptions = {}): T {
	return build(
		node,
		"employerAggregateRating",
		EMPLOYER_AGGREGATE_RATING,
		options,
	);
}

/** An image with its license metadata. */
export function imageObject<T extends NodeOf<ImageObject>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "imageObject", IMAGE_LICENSE, options);
}

export function memberProgram<T extends NodeOf<MemberProgram>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "memberProgram", MEMBER_PROGRAM, options);
}

export function mathSolver<T extends NodeOf<MathSolver>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "mathSolver", MATH_SOLVER, options);
}

export function movie<T extends NodeOf<Movie>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "movie", MOVIE, options);
}

/** A Q&A page; its question and answers are checked too. */
export function qaPage<T extends NodeOf<QAPage>>(
	node: T,
	options: CheckOptions = {},
): T {
	const built = build(node, "qaPage", QA_PAGE, options);
	checkNested(built, "mainEntity", () => QUESTION, options);
	const questions: unknown[] = [Reflect.get(built, "mainEntity")].flat();
	for (const question of questions.filter(isPlainObject)) {
		checkNested(question, "acceptedAnswer", () => ANSWER, options);
		checkNested(question, "suggestedAnswer", () => ANSWER, options);
	}
	return built;
}

export function merchantReturnPolicy<T extends NodeOf<MerchantReturnPolicy>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "merchantReturnPolicy", MERCHANT_RETURN_POLICY, options);
}

export function shippingService<T extends NodeOf<ShippingService>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "shippingService", SHIPPING_SERVICE, options);
}

export function vacationRental<T extends NodeOf<VacationRental>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "vacationRental", VACATION_RENTAL, options);
}

export function productGroup<T extends NodeOf<ProductGroup>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "productGroup", PRODUCT_GROUP, options);
}

/**
 * The policies an organization or an offer carries — return, shipping,
 * loyalty — checked where they are nested.
 */
export function checkPolicies(node: object, options: CheckOptions): void {
	checkNested(
		node,
		"hasMerchantReturnPolicy",
		() => MERCHANT_RETURN_POLICY,
		options,
	);
	checkNested(node, "hasShippingService", () => SHIPPING_SERVICE, options);
	checkNested(node, "hasMemberProgram", () => MEMBER_PROGRAM, options);
	checkNested(node, "shippingDetails", () => OFFER_SHIPPING_DETAILS, options);
}
