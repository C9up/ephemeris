export { EphemerisError } from "./errors.js";
export { SchemaGraph, type SchemaGraphOptions } from "./graph.js";
export {
	BREADCRUMB,
	breadcrumb,
	type Crumb,
	LOCAL_BUSINESS,
	localBusiness,
	MAX_BREADCRUMB_ITEMS,
	MAX_TEXT_LENGTH,
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
