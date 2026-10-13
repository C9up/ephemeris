/**
 * What every helper does before Google's rules: the node is a plain object,
 * its text is bounded, its URLs are absolute http(s), its prices, currencies
 * and dates have the form Google reads — refused otherwise, never converted.
 */

import { CURRENCIES } from "./currencies.js";
import { type Data, isPlainObject } from "./data.js";
import { EphemerisError } from "./errors.js";
import {
	type CheckOptions,
	check,
	emitWarning,
	isReference,
	type Rule,
} from "./requirements.js";

/** Longer than any name or description a page shows; a bound, not a style. */
export const MAX_TEXT_LENGTH = 10_000;

/** Properties whose string value is a URL a browser or crawler will follow. */
const URL_KEYS = new Set([
	"url",
	"sameAs",
	"logo",
	"image",
	"item",
	"contentUrl",
	"thumbnailUrl",
	"embedUrl",
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
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

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

function checkPrice(value: unknown, path: string): void {
	const valid =
		typeof value === "number"
			? Number.isFinite(value) && value >= 0
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
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
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
	if (
		(!date && !dateTime) ||
		!realDay(year, month, day) ||
		hour > 23 ||
		minute > 59 ||
		second > 59
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

/** Every value of `node` held to the forms above, at any depth. */
function bound(value: unknown, path: string, key: string, owner: Owner): void {
	if (PRICE_KEYS.has(key) && !Array.isArray(value)) checkPrice(value, path);
	if (CURRENCY_KEYS.has(key) && !Array.isArray(value))
		checkCurrency(value, path);
	if (typeof value === "string") {
		if (value.length > MAX_TEXT_LENGTH) {
			throw new EphemerisError(
				"E_EPHEMERIS_TOO_LONG",
				`${path} is ${value.length} characters, more than ${MAX_TEXT_LENGTH}`,
			);
		}
		if (URL_KEYS.has(key)) checkUrl(value, path);
		if (DATE_KEYS.has(key)) checkDate(value, path, key, owner);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			bound(item, `${path}[${index}]`, key, owner);
		});
		return;
	}
	if (isPlainObject(value)) {
		for (const [name, item] of Object.entries(value)) {
			bound(item, `${path}.${name}`, name, owner);
		}
	}
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
