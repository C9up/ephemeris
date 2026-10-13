/**
 * Nodes for the entities every page carries — the site's identity, the site,
 * the page, the breadcrumb — checked against what Google Search needs of them
 * and bounded, since their values often come from a request or a database.
 *
 * Each returns the node it was given, ready for a `SchemaGraph` slot.
 */

import { build } from "./build.js";
import { isPlainObject } from "./data.js";
import { EphemerisError } from "./errors.js";
import {
	type CheckOptions,
	RequirementError,
	type Rule,
} from "./requirements.js";
import type {
	BreadcrumbList,
	LocalBusiness,
	Organization,
	Person,
	ProfilePage,
	WebPage,
	WebSite,
} from "./schema.js";

const SEARCH_CENTRAL = "https://developers.google.com/search/docs/appearance";

/** More crumbs than any trail a person follows. */
export const MAX_BREADCRUMB_ITEMS = 32;

/** Organization — no property is required; all of these are recommended. */
export const ORGANIZATION: Rule = {
	type: "Organization",
	source: `${SEARCH_CENTRAL}/structured-data/organization`,
	read: "2026-09-08",
	recommended: [
		"name",
		"url",
		"logo",
		"description",
		"sameAs",
		"telephone",
		"email",
		"address",
		"address.streetAddress",
		"address.addressLocality",
		"address.addressRegion",
		"address.postalCode",
		"address.addressCountry",
		"contactPoint",
		"alternateName",
		"legalName",
		"foundingDate",
		"numberOfEmployees",
		"vatID",
		"taxID",
		"iso6523Code",
		"duns",
		"leiCode",
		"globalLocationNumber",
		"naics",
		"hasMerchantReturnPolicy",
		"hasShippingService",
		"hasMemberProgram",
	],
};

/** Whether a coordinate has the 5 decimals Google asks for. */
function decimals(value: unknown): number {
	const text =
		typeof value === "number"
			? String(value)
			: typeof value === "string"
				? value
				: "";
	const dot = text.indexOf(".");
	return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * LocalBusiness. Left out of "recommended": what Google recommends only in a
 * case the node does not tell — `aggregateRating` and `review` (a site about
 * other businesses), `department`, `menu` and `servesCuisine` (restaurants),
 * `validFrom`/`validThrough` (special hours).
 */
export const LOCAL_BUSINESS: Rule = {
	type: "LocalBusiness",
	source: `${SEARCH_CENTRAL}/structured-data/local-business`,
	read: "2026-09-08",
	required: ["name", "address"],
	recommended: [
		"telephone",
		"url",
		"geo",
		"geo.latitude",
		"geo.longitude",
		"openingHoursSpecification",
		"openingHoursSpecification.dayOfWeek",
		"openingHoursSpecification.opens",
		"openingHoursSpecification.closes",
		"priceRange",
	],
	checks: [
		(node, report) => {
			const geo = node.geo;
			if (!isPlainObject(geo)) return;
			for (const axis of ["latitude", "longitude"]) {
				const value = geo[axis];
				if (value !== undefined && decimals(value) < 5) {
					report.warn(
						"W_EPHEMERIS_LOW_PRECISION",
						`geo.${axis}`,
						`LocalBusiness geo.${axis} has ${decimals(value)} decimals; Google needs at least 5`,
					);
				}
			}
		},
		(node, report) => {
			const range = node.priceRange;
			if (typeof range === "string" && range.length >= 100) {
				report.warn(
					"W_EPHEMERIS_TOO_LONG_FOR_GOOGLE",
					"priceRange",
					`LocalBusiness priceRange is ${range.length} characters; Google shows none from 100`,
				);
			}
		},
	],
};

/** WebSite, for the site name: on the home page. */
export const WEBSITE: Rule = {
	type: "WebSite",
	source: `${SEARCH_CENTRAL}/site-names`,
	read: "2025-12-10",
	required: ["name", "url"],
	recommended: ["alternateName"],
};

/** ProfilePage: a page about one person or organization. */
export const PROFILE_PAGE: Rule = {
	type: "ProfilePage",
	source: `${SEARCH_CENTRAL}/structured-data/profile-page`,
	read: "2026-09-08",
	required: ["mainEntity", ["mainEntity.name", "mainEntity.alternateName"]],
	recommended: [
		"dateCreated",
		"dateModified",
		"mainEntity.description",
		"mainEntity.image",
		"mainEntity.sameAs",
		"mainEntity.identifier",
		"mainEntity.interactionStatistic",
		"mainEntity.agentInteractionStatistic",
	],
};

/** The breadcrumb: at least two items, each with its position. */
export const BREADCRUMB: Rule = {
	type: "BreadcrumbList",
	source: `${SEARCH_CENTRAL}/structured-data/breadcrumb`,
	read: "2026-09-08",
	required: ["itemListElement"],
};

type NodeOf<T> = Exclude<T, string>;

/** The organization behind the site. */
export function organization<T extends NodeOf<Organization>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "organization", ORGANIZATION, options);
}

/** A business with a place customers come to — a shop, a restaurant. */
export function localBusiness<T extends NodeOf<LocalBusiness>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "localBusiness", LOCAL_BUSINESS, options);
}

/** A person. Google has no rich result for a person alone: bounded only. */
export function person<T extends NodeOf<Person>>(node: T): T {
	return build(node, "person", undefined, {});
}

/** The website. Google reads it, on the home page, for the site's name. */
export function website<T extends NodeOf<WebSite>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "website", WEBSITE, options);
}

/** A page. Google has no rich result for a page as such: bounded only. */
export function webPage<T extends NodeOf<WebPage>>(node: T): T {
	return build(node, "webPage", undefined, {});
}

/** A page about one person or organization: a profile. */
export function profilePage<T extends NodeOf<ProfilePage>>(
	node: T,
	options: CheckOptions = {},
): T {
	return build(node, "profilePage", PROFILE_PAGE, options);
}

export interface Crumb {
	/** What the trail shows. */
	name: string;
	/** Where it leads; the last crumb may leave it out — Google uses the page. */
	item?: string;
}

/** The breadcrumb trail, positions numbered from 1. */
export function breadcrumb(
	crumbs: readonly Crumb[],
	options: CheckOptions = {},
): NodeOf<BreadcrumbList> {
	const { type, source } = BREADCRUMB;
	if (crumbs.length > MAX_BREADCRUMB_ITEMS) {
		throw new EphemerisError(
			"E_EPHEMERIS_TOO_MANY",
			`a breadcrumb of ${crumbs.length} items is more than ${MAX_BREADCRUMB_ITEMS}`,
		);
	}
	if (crumbs.length < 2) {
		throw new RequirementError(
			type,
			"itemListElement",
			source,
			` of at least two items, not ${crumbs.length}`,
		);
	}
	crumbs.forEach((crumb, index) => {
		if (crumb.name.trim() === "") {
			throw new RequirementError(
				type,
				`itemListElement[${index}].name`,
				source,
			);
		}
		if (crumb.item === undefined && index < crumbs.length - 1) {
			throw new RequirementError(
				type,
				`itemListElement[${index}].item`,
				source,
				" (only the last item may leave it out)",
			);
		}
	});
	return build(
		{
			"@type": "BreadcrumbList",
			itemListElement: crumbs.map((crumb, index) => ({
				"@type": "ListItem",
				position: index + 1,
				name: crumb.name,
				...(crumb.item === undefined ? {} : { item: crumb.item }),
			})),
		},
		"breadcrumb",
		BREADCRUMB,
		options,
	);
}
