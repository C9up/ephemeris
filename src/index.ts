export { EphemerisError } from "./errors.js";
/** The whole schema.org vocabulary, typed: `Schema.Product`, `Schema.WithContext<…>`. */
export type * as Schema from "./schema.js";
export {
	type JsonLdValue,
	jsonLdScriptTag,
	type ScriptTagOptions,
	stringifyJsonLd,
	toJsonLd,
} from "./serialize.js";
