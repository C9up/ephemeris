/** Deeper than any real document; a bound for data that was never one. */
export const MAX_DEPTH = 64;

/**
 * Keys that would reach a prototype if a merge downstream ever assigned them:
 * JSON.parse makes `__proto__` an own key, and `Object.assign` or a `[key] =`
 * merge then sets the target's prototype instead of a property.
 */
export const UNSAFE_KEYS: ReadonlySet<string> = new Set([
	"__proto__",
	"constructor",
	"prototype",
]);

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
