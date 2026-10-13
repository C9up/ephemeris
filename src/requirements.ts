/**
 * What Google Search needs of a node for a rich result, checked as the node is
 * built: a missing required property throws, a missing recommended one is a
 * warning the caller reads or silences — never an error.
 *
 * Each rule is read from Google Search Central, not recalled: its page and the
 * date the page was last updated are on the rule.
 */

import { type Data, isPlainObject } from "./data.js";
import { EphemerisError } from "./errors.js";

/** A warning: not an error, the node is still valid structured data. */
export interface RequirementWarning {
	code:
		| "W_EPHEMERIS_MISSING_RECOMMENDED"
		| "W_EPHEMERIS_LOW_PRECISION"
		| "W_EPHEMERIS_TOO_LONG_FOR_GOOGLE";
	/** The type the rule is for, as Google names it. */
	type: string;
	/** The property, dotted for a nested one: `address.postalCode`. */
	property: string;
	message: string;
	/** The Search Central page the rule comes from. */
	source: string;
}

export type WarningHandler = (warning: RequirementWarning) => void;

export interface CheckOptions {
	/**
	 * Receives each warning. Unset, each kind of warning is written once per
	 * process with `console.warn`; `() => {}` silences them.
	 */
	onWarning?: WarningHandler;
}

/** A required property is missing: Google would not show the rich result. */
export class RequirementError extends EphemerisError {
	readonly type: string;
	readonly property: string;
	readonly source: string;

	constructor(type: string, property: string, source: string, detail = "") {
		super(
			"E_EPHEMERIS_MISSING_REQUIRED",
			`${type} needs ${property}${detail} — ${source}`,
		);
		this.type = type;
		this.property = property;
		this.source = source;
	}
}

export interface Rule {
	type: string;
	source: string;
	/** The page's "Last updated" date when the rule was read. */
	read: string;
	/** A property, or alternatives of which one must be there. */
	required?: readonly (string | readonly [string, ...string[]])[];
	recommended?: readonly string[];
	checks?: readonly ((node: Data, report: Reporter) => void)[];
}

export interface Reporter {
	warn(
		code: RequirementWarning["code"],
		property: string,
		message: string,
	): void;
	fail(property: string, detail?: string): never;
}

/** A node given only by reference: its properties are described elsewhere. */
export function isReference(value: unknown): boolean {
	return (
		isPlainObject(value) && Object.keys(value).every((key) => key === "@id")
	);
}

export function isEmpty(value: unknown): boolean {
	if (value === undefined || value === null || value === "") return true;
	if (Array.isArray(value)) return value.every(isEmpty);
	return false;
}

/**
 * The parents a dotted path's last segment hangs off, each an object whose
 * properties are given here: `address.postalCode` checks every address that is
 * an object, and none when the address is a string or a reference.
 */
/** `address.postalCode` → `postalCode`. */
function lastSegment(path: string): string {
	return path.slice(path.lastIndexOf(".") + 1);
}

function parentsOf(node: Data, path: string): { owner: Data; key: string }[] {
	const segments = path.split(".").slice(0, -1);
	const key = lastSegment(path);
	let owners: Data[] = [node];
	for (const segment of segments) {
		owners = owners.flatMap((owner) =>
			[owner[segment]]
				.flat()
				.filter(
					(value): value is Data => isPlainObject(value) && !isReference(value),
				),
		);
	}
	return owners.map((owner) => ({ owner, key }));
}

const warned = new Set<string>();

function defaultWarning(warning: RequirementWarning): void {
	// The key is a rule's type, property and code — a fixed set, never data.
	const key = `${warning.type}|${warning.property}|${warning.code}`;
	if (warned.has(key)) return;
	warned.add(key);
	console.warn(`[ephemeris] ${warning.message} — ${warning.source}`);
}

/** Checks `node` against `rule`; throws on a missing required property. */
export function check(
	rule: Rule,
	node: Data,
	options: CheckOptions = {},
): void {
	const onWarning = options.onWarning ?? defaultWarning;
	const report: Reporter = {
		warn(code, property, message) {
			onWarning({
				code,
				type: rule.type,
				property,
				message,
				source: rule.source,
			});
		},
		fail(property, detail = "") {
			throw new RequirementError(rule.type, property, rule.source, detail);
		},
	};
	for (const required of rule.required ?? []) {
		const alternatives: readonly [string, ...string[]] =
			typeof required === "string" ? [required] : required;
		for (const { owner } of parentsOf(node, alternatives[0])) {
			const present = alternatives.some(
				(path) => !isEmpty(owner[lastSegment(path)]),
			);
			if (!present) report.fail(alternatives.join(" or "));
		}
	}
	for (const property of rule.recommended ?? []) {
		for (const { owner, key } of parentsOf(node, property)) {
			if (isEmpty(owner[key])) {
				report.warn(
					"W_EPHEMERIS_MISSING_RECOMMENDED",
					property,
					`${rule.type} has no ${property}, which Google recommends`,
				);
			}
		}
	}
	for (const extra of rule.checks ?? []) extra(node, report);
}
