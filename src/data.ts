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

/**
 * Each node a helper returned, with the values it checked: what its `toJSON`s
 * and `Date`s gave, resolved once. The serializer writes these, so a `toJSON`
 * that answers differently the second time, or a change made to the node
 * after the helper, is never written unchecked.
 */
const CHECKED = new WeakMap<object, Data>();

export function rememberChecked(node: object, data: Data): void {
	CHECKED.set(node, data);
}

/** The values a helper checked for `node`, if a helper returned it. */
export function checkedData(node: object): Data | undefined {
	return CHECKED.get(node);
}
