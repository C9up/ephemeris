/**
 * JSON-LD out of a page: the `<script type="application/ld+json">` for the
 * HTML, or the plain object for a client that updates the page itself.
 *
 * Structured data carries what a database holds — a product name, a review —
 * and a `</script>` in it would end the tag and run whatever follows. The
 * text written here has no `<`, `>` or `&` at all: they are `\u003c`,
 * `\u003e` and `\u0026`, which JSON reads back as the same characters, so no
 * closing tag and no `<!--` can appear, whatever the case or spacing. U+2028
 * and U+2029 are escaped too, for a reader that takes the text as JavaScript.
 *
 * A value JSON cannot hold faithfully is refused rather than turned into
 * something else: `JSON.stringify` makes `NaN` a `null`, a `Map` an `{}`, and
 * throws on a cycle or a `bigint`.
 */

import { checkedData, isPlainObject, MAX_DEPTH } from "./data.js";
import {
	E_EPHEMERIS_CYCLE,
	E_EPHEMERIS_INVALID_VALUE,
	E_EPHEMERIS_TOO_DEEP,
} from "./errors.js";

/** A JSON-LD value once normalized: what `JSON.parse` would give back. */
export type JsonLdValue =
	| string
	| number
	| boolean
	| null
	| JsonLdValue[]
	| { [key: string]: JsonLdValue };

export interface ScriptTagOptions {
	/**
	 * This request's CSP nonce. Never made up here: a nonce the policy does
	 * not name would not match it.
	 */
	nonce?: string;
}

/** Nothing: the property or entry is left out, as JSON leaves `undefined`. */
const OMIT = Symbol("omit");

function pathOf(path: readonly (string | number)[]): string {
	return path.length === 0
		? "the value"
		: path
				.map((part, index) =>
					typeof part === "number"
						? `[${part}]`
						: index === 0
							? part
							: `.${part}`,
				)
				.join("");
}

/** Refuse a value JSON cannot hold, named by where it sits. */
function refuse(path: readonly (string | number)[], reason: string): never {
	throw new E_EPHEMERIS_INVALID_VALUE([pathOf(path), reason]);
}

function normalize(
	value: unknown,
	path: (string | number)[],
	ancestors: Set<object>,
	fromToJSON = false,
): JsonLdValue | typeof OMIT {
	if (value === undefined) return OMIT;
	if (value === null) return null;
	if (typeof value === "string" || typeof value === "boolean") return value;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			refuse(path, `is ${value}, not a number JSON can hold`);
		}
		return value;
	}
	if (typeof value === "object") {
		return normalizeObject(value, path, ancestors, fromToJSON);
	}
	return refuse(path, `is a ${typeof value}, which JSON cannot hold`);
}

function normalizeObject(
	given: object,
	path: (string | number)[],
	ancestors: Set<object>,
	fromToJSON = false,
): JsonLdValue | typeof OMIT {
	// A node a helper returned is written as the values it checked.
	const value = checkedData(given) ?? given;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			refuse(path, "is an invalid Date");
		}
		return value.toISOString();
	}
	const toJSON: unknown = Reflect.get(value, "toJSON");
	if (typeof toJSON === "function" && !fromToJSON) {
		// A value that says how it is written — a Decimal, a Luxon date. Called
		// once, as JSON calls it: what it gives is written as it is.
		return normalize(Reflect.apply(toJSON, value, []), path, ancestors, true);
	}
	if (ancestors.has(value)) {
		throw new E_EPHEMERIS_CYCLE([pathOf(path)]);
	}
	if (path.length >= MAX_DEPTH) {
		throw new E_EPHEMERIS_TOO_DEEP([pathOf(path), MAX_DEPTH]);
	}
	ancestors.add(value);
	try {
		if (Array.isArray(value)) {
			const items: JsonLdValue[] = [];
			value.forEach((item: unknown, index) => {
				const normalized = normalize(item, [...path, index], ancestors);
				if (normalized !== OMIT) items.push(normalized);
			});
			return items;
		}
		if (!isPlainObject(value)) {
			const name = value.constructor?.name ?? "object";
			refuse(path, `is a ${name}, which JSON would write as {}`);
		}
		const entries: [string, JsonLdValue][] = [];
		for (const [key, item] of Object.entries(value)) {
			// The serialization hook is not data: JSON leaves it out.
			if (key === "toJSON" && typeof item === "function") continue;
			const normalized = normalize(item, [...path, key], ancestors);
			if (normalized !== OMIT) entries.push([key, normalized]);
		}
		// fromEntries defines each key, `__proto__` included, as data.
		return Object.fromEntries(entries);
	} finally {
		ancestors.delete(value);
	}
}

/**
 * The JSON-LD as plain data: `undefined` left out, dates as ISO strings,
 * anything JSON cannot hold refused with `errors.E_EPHEMERIS_INVALID_VALUE`.
 */
export function toJsonLd(data: object): JsonLdValue {
	const normalized = normalizeObject(data, [], new Set());
	if (normalized === OMIT) {
		refuse([], "is empty: its toJSON gave nothing");
	}
	return normalized;
}

/** U+2028 and U+2029, which a JavaScript reader takes as line ends. */
const UNSAFE = /[<>&\u2028\u2029]/g;

function escapeCharacter(character: string): string {
	return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

/** The JSON text, with no character that could end or comment out its tag. */
export function stringifyJsonLd(data: object): string {
	return JSON.stringify(toJsonLd(data)).replace(UNSAFE, escapeCharacter);
}

function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/** `<script type="application/ld+json" nonce="…">…</script>`, for `<head>`. */
export function jsonLdScriptTag(
	data: object,
	options: ScriptTagOptions = {},
): string {
	const nonce =
		options.nonce === undefined || options.nonce === ""
			? ""
			: ` nonce="${escapeAttribute(options.nonce)}"`;
	return `<script type="application/ld+json"${nonce}>${stringifyJsonLd(data)}</script>`;
}
