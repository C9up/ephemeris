export { MAX_TEXT_LENGTH } from "./build.js";
export {
	AGGREGATE_OFFER,
	AGGREGATE_RATING,
	ARTICLE,
	aggregateRating,
	article,
	COURSE,
	course,
	EVENT,
	event,
	JOB_POSTING,
	jobPosting,
	MERCHANT_LISTING,
	MERCHANT_OFFER,
	merchantListing,
	NESTED_AGGREGATE_RATING,
	NESTED_REVIEW,
	OFFER,
	PRODUCT,
	product,
	RECIPE,
	REVIEW,
	recipe,
	review,
	SOFTWARE_APPLICATION,
	softwareApplication,
	VIDEO,
	video,
} from "./content.js";
export { EphemerisError } from "./errors.js";
export { SchemaGraph, type SchemaGraphOptions } from "./graph.js";
export {
	BREADCRUMB,
	breadcrumb,
	type Crumb,
	LOCAL_BUSINESS,
	localBusiness,
	MAX_BREADCRUMB_ITEMS,
	ORGANIZATION,
	organization,
	PROFILE_PAGE,
	person,
	profilePage,
	WEBSITE,
	webPage,
	website,
} from "./helpers.js";
export {
	type CheckOptions,
	type Requirement,
	RequirementError,
	type RequirementWarning,
	type Rule,
	type WarningHandler,
} from "./requirements.js";
/** The whole schema.org vocabulary, typed: `Schema.Product`, `Schema.WithContext<…>`. */
export type * as Schema from "./schema.js";
export {
	type JsonLdValue,
	jsonLdScriptTag,
	type ScriptTagOptions,
	stringifyJsonLd,
	toJsonLd,
} from "./serialize.js";
