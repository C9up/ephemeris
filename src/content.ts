/**
 * Nodes for what a page is about — an article, a product for sale, a review,
 * an event, a job, a recipe, a video, an app, a course — checked against what
 * Google Search needs of each for a rich result, read from Search Central
 * (each rule carries its page and the page's date).
 *
 * Left out, with Google's reason: FAQ, no longer shown since May 2026
 * (Search Central changelog), and How-to, whose page now redirects there.
 * The other types of the search gallery are not covered yet.
 */

import { build, checkNested } from "./build.js";
import type { Data } from "./data.js";
import type { CheckOptions, Reporter, Rule } from "./requirements.js";
import type {
	AggregateRating,
	Article,
	Course,
	Event,
	JobPosting,
	Product,
	Recipe,
	Review,
	SoftwareApplication,
	VideoObject,
} from "./schema.js";

const PAGES =
	"https://developers.google.com/search/docs/appearance/structured-data";

type NodeOf<T> = Exclude<T, string>;

/** Whether a node's `@type` names `type`. */
function hasType(node: Data, type: string): boolean {
	return [node["@type"]].flat().includes(type);
}

function textLength(
	property: string,
	limit: number,
	why: string,
): (node: Data, report: Reporter) => void {
	return (node, report) => {
		const value = node[property];
		if (typeof value === "string" && value.length >= limit) {
			report.warn(
				"W_EPHEMERIS_TOO_LONG_FOR_GOOGLE",
				property,
				`${property} is ${value.length} characters; ${why}`,
			);
		}
	};
}

/** Article, NewsArticle, BlogPosting: nothing is required. */
export const ARTICLE: Rule = {
	type: "Article",
	source: `${PAGES}/article`,
	read: "2026-09-08",
	recommended: [
		"headline",
		"image",
		"datePublished",
		"dateModified",
		"author",
		"author.name",
		"author.url",
	],
};

/** A review nested in what it reviews: the parent is the item reviewed. */
export const NESTED_REVIEW: Rule = {
	type: "Review",
	source: `${PAGES}/review-snippet`,
	read: "2026-09-08",
	required: ["author", "reviewRating", "reviewRating.ratingValue"],
	recommended: [
		"datePublished",
		"reviewRating.bestRating",
		"reviewRating.worstRating",
	],
	checks: [
		(node, report) => {
			for (const author of [node.author].flat()) {
				const name =
					typeof author === "string"
						? author
						: typeof author === "object" && author !== null
							? Reflect.get(author, "name")
							: undefined;
				if (typeof name === "string" && name.length >= 100) {
					report.warn(
						"W_EPHEMERIS_TOO_LONG_FOR_GOOGLE",
						"author.name",
						"Review author's name must be shorter than 100 characters",
					);
				}
			}
		},
	],
};

/** A review on its own: it names the item it reviews. */
export const REVIEW: Rule = {
	...NESTED_REVIEW,
	required: [
		"author",
		"itemReviewed",
		"itemReviewed.name",
		"reviewRating",
		"reviewRating.ratingValue",
	],
};

/** An aggregate rating nested in what it rates. */
export const NESTED_AGGREGATE_RATING: Rule = {
	type: "AggregateRating",
	source: `${PAGES}/review-snippet`,
	read: "2026-09-08",
	required: ["ratingValue", ["ratingCount", "reviewCount"]],
	recommended: ["bestRating", "worstRating"],
};

/** An aggregate rating on its own: it names the item it rates. */
export const AGGREGATE_RATING: Rule = {
	...NESTED_AGGREGATE_RATING,
	required: [
		"itemReviewed",
		"itemReviewed.name",
		"ratingValue",
		["ratingCount", "reviewCount"],
	],
};

/** An offer in a product snippet. */
export const OFFER: Rule = {
	type: "Offer",
	source: `${PAGES}/product-snippet`,
	read: "2026-09-08",
	required: [["price", "priceSpecification.price"]],
	recommended: [
		"availability",
		["priceCurrency", "priceSpecification.priceCurrency"],
		"priceValidUntil",
	],
};

/** Several sellers' offers, as a range. */
export const AGGREGATE_OFFER: Rule = {
	type: "AggregateOffer",
	source: `${PAGES}/product-snippet`,
	read: "2026-09-08",
	required: ["lowPrice", "priceCurrency"],
	recommended: ["highPrice", "offerCount"],
};

/** A product: a review page or a shopping aggregator's (product snippet). */
export const PRODUCT: Rule = {
	type: "Product",
	source: `${PAGES}/product-snippet`,
	read: "2026-09-08",
	required: ["name", ["review", "aggregateRating", "offers"]],
	recommended: ["aggregateRating", "offers", "review"],
};

/** The merchant's own offer: a price in a currency, one seller. */
export const MERCHANT_OFFER: Rule = {
	type: "Offer",
	source: `${PAGES}/merchant-listing`,
	read: "2026-09-08",
	required: [
		["price", "priceSpecification.price"],
		["priceCurrency", "priceSpecification.priceCurrency"],
	],
	recommended: [
		"availability",
		"itemCondition",
		"url",
		"priceValidUntil",
		"shippingDetails",
		"hasMerchantReturnPolicy",
	],
};

/**
 * A product the page sells (merchant listing). Left out of "recommended":
 * what applies to some products only — apparel's color, material, pattern,
 * size and audience; adult content; certifications; variants; a 3D model.
 */
export const MERCHANT_LISTING: Rule = {
	type: "Product",
	source: `${PAGES}/merchant-listing`,
	read: "2026-09-08",
	required: ["name", "image", "offers"],
	recommended: [
		"description",
		"sku",
		"mpn",
		["gtin", "gtin8", "gtin12", "gtin13", "gtin14", "isbn"],
		"brand.name",
		"category",
		"aggregateRating",
		"review",
	],
	checks: [
		(node, report) => {
			for (const offer of [node.offers].flat()) {
				if (
					typeof offer === "object" &&
					offer !== null &&
					[Reflect.get(offer, "@type")].flat().includes("AggregateOffer")
				) {
					report.fail(
						"offers",
						" to be an Offer: a merchant listing is the seller's own, not an AggregateOffer",
					);
				}
			}
		},
	],
};

/**
 * Event. `previousStartDate` is left out of "recommended": it applies to a
 * rescheduled event only.
 */
export const EVENT: Rule = {
	type: "Event",
	source: `${PAGES}/event`,
	read: "2026-09-08",
	required: ["name", "startDate", "location", "location.address"],
	recommended: [
		"description",
		"endDate",
		"eventStatus",
		"image",
		"location.name",
		"offers",
		"offers.availability",
		"offers.price",
		"offers.priceCurrency",
		"offers.validFrom",
		"offers.url",
		"organizer",
		"organizer.name",
		"organizer.url",
		"performer",
		"performer.name",
	],
};

function isRemote(node: Data): boolean {
	return [node.jobLocationType].flat().includes("TELECOMMUTE");
}

/**
 * JobPosting. A job on site needs its `jobLocation`; a fully remote one
 * (`jobLocationType: "TELECOMMUTE"`) needs the countries applicants may work
 * from — `applicantLocationRequirements`, or a `jobLocation`.
 */
export const JOB_POSTING: Rule = {
	type: "JobPosting",
	source: `${PAGES}/job-posting`,
	read: "2026-09-08",
	required: ["title", "description", "datePosted", "hiringOrganization"],
	recommended: [
		"baseSalary",
		"employmentType",
		"identifier",
		"validThrough",
		"directApply",
	],
	checks: [
		(node, report) => {
			const has = (key: string) =>
				[node[key]]
					.flat()
					.some(
						(value) => value !== undefined && value !== null && value !== "",
					);
			if (isRemote(node)) {
				if (!has("applicantLocationRequirements") && !has("jobLocation")) {
					report.fail(
						"applicantLocationRequirements or jobLocation",
						" for a fully remote job",
					);
				}
			} else if (!has("jobLocation")) {
				report.fail("jobLocation");
			}
		},
	],
};

/** Recipe. */
export const RECIPE: Rule = {
	type: "Recipe",
	source: `${PAGES}/recipe`,
	read: "2026-09-08",
	required: ["name", "image"],
	recommended: [
		"description",
		"author",
		"datePublished",
		"aggregateRating",
		"prepTime",
		"cookTime",
		"totalTime",
		"recipeYield",
		"recipeCategory",
		"recipeCuisine",
		"recipeIngredient",
		"recipeInstructions",
		"keywords",
		"nutrition.calories",
	],
	checks: [
		(node, report) => {
			const nutrition = node.nutrition;
			const calories =
				typeof nutrition === "object" && nutrition !== null
					? Reflect.get(nutrition, "calories")
					: undefined;
			if (calories !== undefined && node.recipeYield === undefined) {
				report.fail("recipeYield", ", which nutrition.calories is counted per");
			}
		},
	],
};

/**
 * VideoObject. What applies to some videos only is left out of
 * "recommended": live broadcasts, clips, expiry, regions, statistics.
 */
export const VIDEO: Rule = {
	type: "VideoObject",
	source: `${PAGES}/video`,
	read: "2026-09-24",
	required: ["name", "thumbnailUrl", "uploadDate"],
	recommended: [
		"description",
		"duration",
		"contentUrl",
		"embedUrl",
		["creator", "author"],
	],
};

/** SoftwareApplication: a price, and a rating or a review. */
export const SOFTWARE_APPLICATION: Rule = {
	type: "SoftwareApplication",
	source: `${PAGES}/software-app`,
	read: "2026-09-08",
	required: ["name", "offers", "offers.price", ["aggregateRating", "review"]],
	recommended: ["applicationCategory", "operatingSystem"],
};

/** Course. Google shows 60 characters of the description. */
export const COURSE: Rule = {
	type: "Course",
	source: `${PAGES}/course`,
	read: "2026-09-08",
	required: ["name", "description"],
	recommended: ["provider"],
	checks: [
		textLength(
			"description",
			61,
			"Google shows the first 60 characters of a course description",
		),
	],
};

function ratings(node: object, options: CheckOptions): void {
	checkNested(node, "review", () => NESTED_REVIEW, options);
	checkNested(node, "aggregateRating", () => NESTED_AGGREGATE_RATING, options);
}

/** An article, a news article or a blog post. */
export function article<T extends NodeOf<Article>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "article", ARTICLE, options);
}

/**
 * A product reviewed or compared (product snippet): its offers, reviews and
 * rating are checked too.
 */
export function product<T extends NodeOf<Product>>(
	node: T,
	options: CheckOptions = {},
): T {
	const built = build(node, "product", PRODUCT, options);
	checkNested(
		built,
		"offers",
		(offer) => (hasType(offer, "AggregateOffer") ? AGGREGATE_OFFER : OFFER),
		options,
	);
	ratings(built, options);
	return built;
}

/** A product the page sells (merchant listing): one seller's offer, priced. */
export function merchantListing<T extends NodeOf<Product>>(
	node: T,
	options: CheckOptions = {},
): T {
	const built = build(node, "merchantListing", MERCHANT_LISTING, options);
	checkNested(built, "offers", () => MERCHANT_OFFER, options);
	ratings(built, options);
	return built;
}

/** A review of something it names. */
export function review<T extends NodeOf<Review>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "review", REVIEW, options);
}

/** The average of the ratings of something it names. */
export function aggregateRating<T extends NodeOf<AggregateRating>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "aggregateRating", AGGREGATE_RATING, options);
}

/** An event: a concert, a talk, a match. */
export function event<T extends NodeOf<Event>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "event", EVENT, options);
}

/** A job offer. */
export function jobPosting<T extends NodeOf<JobPosting>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "jobPosting", JOB_POSTING, options);
}

/** A recipe; its rating is checked too. */
export function recipe<T extends NodeOf<Recipe>>(
	node: T,
	options: CheckOptions = {},
): T {
	const built = build(node, "recipe", RECIPE, options);
	ratings(built, options);
	return built;
}

/** A video. */
export function video<T extends NodeOf<VideoObject>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "video", VIDEO, options);
}

/** An app; its reviews and rating are checked too. */
export function softwareApplication<T extends NodeOf<SoftwareApplication>>(
	node: T,
	options: CheckOptions = {},
): T {
	const built = build(
		node,
		"softwareApplication",
		SOFTWARE_APPLICATION,
		options,
	);
	ratings(built, options);
	return built;
}

/** A course. */
export function course<T extends NodeOf<Course>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "course", COURSE, options);
}
