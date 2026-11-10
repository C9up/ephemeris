/**
 * What every helper does before Google's rules: the node is a plain object,
 * its text is bounded, its URLs are absolute http(s), its prices, currencies
 * and dates have the form Google reads — refused otherwise, never converted.
 */

import { CURRENCIES } from "./currencies.js";
import { type Data, isPlainObject, MAX_DEPTH, UNSAFE_KEYS } from "./data.js";
import { EphemerisError } from "./errors.js";
import {
	type CheckOptions,
	check,
	emitWarning,
	isReference,
	type Rule,
} from "./requirements.js";
import { URL_OR_TEXT_PROPERTIES, URL_PROPERTIES } from "./url-properties.js";

/** Longer than any name or description a page shows; a bound, not a style. */
export const MAX_TEXT_LENGTH = 10_000;

/**
 * Keys Google reads as a URL that the vocabulary does not range over URL
 * alone: a breadcrumb's `item`, an entry point's `urlTemplate`, an action's
 * `target`. The rest comes from the release, in url-properties.ts.
 */
const GOOGLE_URL_KEYS = new Set(["item", "urlTemplate", "target"]);

/**
 * Schemes that run or embed what they carry once followed or rendered as a
 * link. Refused in a property whose string may be a URL or text, where the
 * text itself ("note: anvils") must stay allowed.
 */
const EXECUTABLE_SCHEMES = new Set([
	"javascript:",
	"vbscript:",
	"data:",
	"file:",
	"blob:",
]);

/** What an absolute `@id` may be: a web IRI or one that names, never runs. */
export const ID_SCHEMES = new Set([
	"https:",
	"http:",
	"urn:",
	"mailto:",
	"tel:",
]);

/** Amounts Google reads as a number, or a string of one with a `.`. */
const PRICE_KEYS = new Set([
	"price",
	"lowPrice",
	"highPrice",
	"minPrice",
	"maxPrice",
]);

/** Google's general guidelines, for a check that belongs to no one type. */
const GUIDELINES =
	"https://developers.google.com/search/docs/appearance/structured-data/sd-policies";

/** ISO 4217 codes, from the list kept in the package. */
const CURRENCY_KEYS = new Set(["priceCurrency", "currency", "salaryCurrency"]);

/** ISO 8601 dates and date-times. */
const DATE_KEYS = new Set([
	"datePublished",
	"dateModified",
	"dateCreated",
	"datePosted",
	"uploadDate",
	"startDate",
	"endDate",
	"previousStartDate",
	"validFrom",
	"validThrough",
	"priceValidUntil",
	"expires",
	"foundingDate",
]);

const DECIMAL = /^\d+(\.\d+)?$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-](\d{2}):(\d{2}))?$/;

function checkUrl(value: string, path: string): void {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_URL",
			`${path} must be an absolute URL, not "${value.slice(0, 200)}"`,
		);
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_URL",
			`${path} must be an http(s) URL, not a ${url.protocol} one`,
		);
	}
}

/** The URL `value` parses to on its own, or undefined when it is relative or text. */
function absolute(value: string): URL | undefined {
	try {
		return new URL(value);
	} catch {
		return undefined;
	}
}

/** A string that may be text, refused only when it is an executable URL. */
function checkNotExecutable(value: string, path: string): void {
	const url = absolute(value);
	if (url !== undefined && EXECUTABLE_SCHEMES.has(url.protocol)) {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_URL",
			`${path} must not be a ${url.protocol} URL`,
		);
	}
}

/** An `@id`: relative, or absolute with a scheme from {@link ID_SCHEMES}. */
export function checkId(value: string, path: string): void {
	const url = absolute(value);
	if (url !== undefined && !ID_SCHEMES.has(url.protocol)) {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_URL",
			`${path} must be a relative, http(s), urn:, mailto: or tel: IRI, not a ${url.protocol} one`,
		);
	}
}

function checkPrice(value: unknown, path: string): void {
	// A number is held to the same form as a string: 1e21 and 1e-7 are written
	// in exponent notation, which is not a price Google reads.
	const valid =
		typeof value === "number"
			? Number.isFinite(value) && DECIMAL.test(String(value))
			: typeof value === "string" && DECIMAL.test(value);
	if (!valid) {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_PRICE",
			`${path} must be a number, or digits with a "." for decimals — no currency sign, no thousands separator — not ${JSON.stringify(value)}`,
		);
	}
}

function checkCurrency(value: unknown, path: string): void {
	if (typeof value !== "string" || !CURRENCIES.has(value)) {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_CURRENCY",
			`${path} must be an ISO 4217 currency code such as "CHF", not ${JSON.stringify(value)}`,
		);
	}
}

/** Whether year, month and day name a day that exists. */
function realDay(year: string, month: string, day: string): boolean {
	// setUTCFullYear, not Date.UTC: the latter reads years 0 to 99 as 1900s.
	const date = new Date(0);
	date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
	return (
		date.getUTCFullYear() === Number(year) &&
		date.getUTCMonth() === Number(month) - 1 &&
		date.getUTCDate() === Number(day)
	);
}

/** Who a value belongs to, for the warnings it raises. */
interface Owner {
	type: string;
	source: string;
	options: CheckOptions;
}

function checkDate(
	value: string,
	path: string,
	key: string,
	owner: Owner,
): void {
	const date = DATE.exec(value);
	const dateTime = date ? undefined : DATE_TIME.exec(value);
	const [, year = "", month = "", day = ""] = date ?? dateTime ?? [];
	const hour = Number(dateTime?.[4] ?? 0);
	const minute = Number(dateTime?.[5] ?? 0);
	const second = Number(dateTime?.[6] ?? 0);
	// Offsets run from -12:00 to +14:00; anything past ±14:59 is no zone.
	const offsetHours = Number(dateTime?.[8] ?? 0);
	const offsetMinutes = Number(dateTime?.[9] ?? 0);
	if (
		(!date && !dateTime) ||
		!realDay(year, month, day) ||
		hour > 23 ||
		minute > 59 ||
		second > 59 ||
		offsetHours > 14 ||
		offsetMinutes > 59
	) {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_DATE",
			`${path} must be an ISO 8601 date or date-time, not "${value.slice(0, 100)}"`,
		);
	}
	if (dateTime && dateTime[7] === undefined) {
		emitWarning(owner.options, {
			code: "W_EPHEMERIS_NO_TIMEZONE",
			type: owner.type,
			// The key, not the path: a warning written once per kind must not
			// have a kind per array index.
			property: key,
			message: `${path} has no time zone; Google then assumes Googlebot's`,
			source: owner.source,
		});
	}
}

/**
 * What the serializer writes for `value`, resolved the way serialize.ts
 * resolves it: a `Date` as its ISO string, an object with `toJSON` as what
 * that gives (called once), an array or plain object as itself. The checks
 * hold for that, not for the object producing it: a `URL` instance of
 * `javascript:` or a `toJSON` returning 50,000 characters is written as a
 * string all the same. Anything else JSON would write as `{}`, so it is
 * refused here as the serializer refuses it.
 */
function written(value: object, path: string, fromToJSON: boolean): unknown {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw new EphemerisError(
				"E_EPHEMERIS_INVALID_VALUE",
				`${path} is an invalid Date`,
			);
		}
		return value.toISOString();
	}
	const toJSON: unknown = Reflect.get(value, "toJSON");
	if (typeof toJSON === "function" && !fromToJSON) {
		const result: unknown = Reflect.apply(toJSON, value, []);
		return typeof result === "object" && result !== null
			? written(result, path, true)
			: result;
	}
	if (Array.isArray(value) || isPlainObject(value)) return value;
	throw new EphemerisError(
		"E_EPHEMERIS_INVALID_VALUE",
		`${path} is a ${value.constructor?.name ?? "object"}, which JSON would write as {}`,
	);
}

/**
 * Every value of `node` held to the forms above, at any depth — bounded like
 * any document: a cycle or 64 levels of nesting is refused, never a stack
 * overflow.
 */
function bound(
	given: unknown,
	path: string,
	key: string,
	owner: Owner,
	ancestors: Set<object> = new Set(),
	depth = 0,
): void {
	const value =
		typeof given === "object" && given !== null
			? written(given, path, false)
			: given;
	// Absent is absent: the serializer and the graph leave it out.
	if (value === undefined || value === null) return;
	if (PRICE_KEYS.has(key) && !Array.isArray(value)) checkPrice(value, path);
	if (CURRENCY_KEYS.has(key) && !Array.isArray(value))
		checkCurrency(value, path);
	if (
		DATE_KEYS.has(key) &&
		(typeof value === "number" || typeof value === "boolean")
	) {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_DATE",
			`${path} must be an ISO 8601 date or date-time, not the ${typeof value} ${String(value)}`,
		);
	}
	if (typeof value === "string") {
		if (value.length > MAX_TEXT_LENGTH) {
			throw new EphemerisError(
				"E_EPHEMERIS_TOO_LONG",
				`${path} is ${value.length} characters, more than ${MAX_TEXT_LENGTH}`,
			);
		}
		if (URL_PROPERTIES.has(key) || GOOGLE_URL_KEYS.has(key)) {
			checkUrl(value, path);
		} else if (URL_OR_TEXT_PROPERTIES.has(key)) {
			checkNotExecutable(value, path);
		} else if (key === "@id") {
			checkId(value, path);
		}
		if (DATE_KEYS.has(key)) checkDate(value, path, key, owner);
		return;
	}
	if (typeof value !== "object") return;
	if (ancestors.has(value)) {
		throw new EphemerisError("E_EPHEMERIS_CYCLE", `${path} contains itself`);
	}
	if (depth >= MAX_DEPTH) {
		throw new EphemerisError(
			"E_EPHEMERIS_TOO_DEEP",
			`${path} is nested deeper than ${MAX_DEPTH} levels`,
		);
	}
	ancestors.add(value);
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			bound(item, `${path}[${index}]`, key, owner, ancestors, depth + 1);
		});
	} else if (isPlainObject(value)) {
		for (const [name, item] of Object.entries(value)) {
			if (UNSAFE_KEYS.has(name)) {
				throw new EphemerisError(
					"E_EPHEMERIS_UNSAFE_KEY",
					`${path}.${name} is not a key structured data may use`,
				);
			}
			bound(item, `${path}.${name}`, name, owner, ancestors, depth + 1);
		}
	}
	ancestors.delete(value);
}

/** The node, held to the forms above and checked against `rule`. */
export function build<T extends object>(
	node: T,
	what: string,
	rule: Rule | undefined,
	options: CheckOptions,
): T {
	if (!isPlainObject(node)) {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_NODE",
			`${what} must be a plain object`,
		);
	}
	bound(node, what, "", {
		type: rule?.type ?? what,
		source: rule?.source ?? GUIDELINES,
		options,
	});
	if (rule) check(rule, node, options);
	return node;
}

/**
 * Checks each object under `key` — an offer, a nested review — against the
 * rule `ruleOf` picks for it; a reference is described elsewhere and skipped.
 */
export function checkNested(
	node: object,
	key: string,
	ruleOf: (child: Data) => Rule,
	options: CheckOptions,
): void {
	for (const child of [Reflect.get(node, key)].flat()) {
		if (isPlainObject(child) && !isReference(child)) {
			check(ruleOf(child), child, options);
		}
	}
}
