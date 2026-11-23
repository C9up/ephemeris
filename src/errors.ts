/**
 * Ephemeris errors, one per code.
 *
 * Structured data often carries what a request sent, so a refusal has to be
 * something a caller can branch on: a stable `E_EPHEMERIS_<REASON>` code
 * (`error.code`, or `instanceof errors.E_EPHEMERIS_…`), not a message.
 *
 * Most messages name the value refused, then what is wrong with it: those
 * take the two as `[what, reason]`.
 */
import { createError, Exception } from "@c9up/flare";

/** A URL property that is not an absolute http(s) URL, or an `@id` that is no URL. */
export const E_EPHEMERIS_INVALID_URL = createError<[string, string]>(
	"%s %s",
	"E_EPHEMERIS_INVALID_URL",
);

/** A key structured data may not use. */
export const E_EPHEMERIS_UNSAFE_KEY = createError<[string]>(
	"%s is not a key structured data may use",
	"E_EPHEMERIS_UNSAFE_KEY",
);

/** A node that is not a plain object, or has no `@type`. */
export const E_EPHEMERIS_INVALID_NODE = createError<[string, string]>(
	"%s %s",
	"E_EPHEMERIS_INVALID_NODE",
);

/** An `@id` the graph generated for another node. */
export const E_EPHEMERIS_ID_TAKEN = createError<[string]>(
	"%s was generated for another node; give this one an id of its own",
	"E_EPHEMERIS_ID_TAKEN",
);

/** A graph slot already holds another node. */
export const E_EPHEMERIS_SLOT_TAKEN = createError<[string, string, string]>(
	"%s is already %s; a node with @id %s is another one, not a layer of it",
	"E_EPHEMERIS_SLOT_TAKEN",
);

/** More items than a list allows. */
export const E_EPHEMERIS_TOO_MANY = createError<[number, number]>(
	"a breadcrumb of %d items is more than %d",
	"E_EPHEMERIS_TOO_MANY",
);

/** A price that is not a number, or digits with a `.` for decimals. */
export const E_EPHEMERIS_INVALID_PRICE = createError<[string, unknown]>(
	'%s must be a number, or digits with a "." for decimals — no currency sign, no thousands separator — not %j',
	"E_EPHEMERIS_INVALID_PRICE",
);

/** A currency that is not an ISO 4217 code. */
export const E_EPHEMERIS_INVALID_CURRENCY = createError<[string, unknown]>(
	'%s must be an ISO 4217 currency code such as "CHF", not %j',
	"E_EPHEMERIS_INVALID_CURRENCY",
);

/** A date that is not ISO 8601. */
export const E_EPHEMERIS_INVALID_DATE = createError<[string, string]>(
	"%s must be an ISO 8601 date or date-time, not %s",
	"E_EPHEMERIS_INVALID_DATE",
);

/** A value JSON cannot hold, or would write as something else. */
export const E_EPHEMERIS_INVALID_VALUE = createError<[string, string]>(
	"%s %s",
	"E_EPHEMERIS_INVALID_VALUE",
);

/** A text longer than structured data allows. */
export const E_EPHEMERIS_TOO_LONG = createError<[string, number, number]>(
	"%s is %d characters, more than %d",
	"E_EPHEMERIS_TOO_LONG",
);

/** A value that contains itself. */
export const E_EPHEMERIS_CYCLE = createError<[string]>(
	"%s contains itself",
	"E_EPHEMERIS_CYCLE",
);

/** A value nested deeper than the limit. */
export const E_EPHEMERIS_TOO_DEEP = createError<[string, number]>(
	"%s is nested deeper than %d levels",
	"E_EPHEMERIS_TOO_DEEP",
);

/**
 * A property Google requires for a rich result is missing: Google would not
 * show it. Carries the type, the property and the Search Central page the
 * rule comes from.
 */
export class E_EPHEMERIS_MISSING_REQUIRED extends Exception {
	static override code = "E_EPHEMERIS_MISSING_REQUIRED";
	static override message = "A property Google requires is missing";

	/** The type the rule is for, as Google names it. */
	readonly type: string;
	/** The property, dotted for a nested one: `address.postalCode`. */
	readonly property: string;
	/** The Search Central page the rule comes from. */
	readonly source: string;

	constructor(
		type: string,
		property: string,
		source: string,
		detail = "",
		options?: ErrorOptions,
	) {
		super(`${type} needs ${property}${detail} — ${source}`, options);
		this.type = type;
		this.property = property;
		this.source = source;
	}
}
