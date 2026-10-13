/** Deeper than any real document; a bound for data that was never one. */
export const MAX_DEPTH = 64;

/** Structured data as it is handled: plain objects keyed by property. */
export type Data = Record<string, unknown>;

/**
 * An object literal or `JSON.parse` output — not an array, a `Date`, a `Map`
 * or a class instance, which JSON would not write as their properties.
 */
export function isPlainObject(value: unknown): value is Data {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
