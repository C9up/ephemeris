export { EphemerisError } from "./errors.js";
export { SchemaGraph, type SchemaGraphOptions } from "./graph.js";
/** The whole schema.org vocabulary, typed: `Schema.Product`, `Schema.WithContext<…>`. */
export type * as Schema from "./schema.js";
export {
	type JsonLdValue,
	jsonLdScriptTag,
	type ScriptTagOptions,
	stringifyJsonLd,
	toJsonLd,
} from "./serialize.js";
