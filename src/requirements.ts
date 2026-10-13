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
		| "W_EPHEMERIS_TOO_LONG_FOR_GOOGLE"
		| "W_EPHEMERIS_NO_TIMEZONE";
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

/** `"name"`, a dotted `"address.postalCode"`, or alternatives. */
export type Requirement = string | readonly [string, ...string[]];

export interface Rule {
	type: string;
	source: string;
	/** The page's "Last updated" date when the rule was read. */
	read: string;
	/** A property, or alternatives of which one must be there. */
	required?: readonly Requirement[];
	/** The same, for what Google recommends. */
	recommended?: readonly Requirement[];
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
export function isReference(value: Data): boolean {
	// `{}` is not a reference: it names nothing, and would skip every check.
	const keys = Object.keys(value);
	return keys.length > 0 && keys.every((key) => key === "@id");
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
function objectsIn(value: unknown): Data[] {
	return [value]
		.flat()
		.filter((item): item is Data => isPlainObject(item) && !isReference(item));
}

/** The objects `segments` lead to from `node`, through arrays. */
function walk(node: Data, segments: readonly string[]): Data[] {
	let owners: Data[] = [node];
	for (const segment of segments) {
		owners = owners.flatMap((owner) => objectsIn(owner[segment]));
	}
	return owners;
}

/**
 * Where alternatives are judged: the parent their paths share. For `price` or
 * `priceSpecification.price` it is the offer; for `mainEntity.name` or
 * `mainEntity.alternateName`, each main entity. A parent that is absent, a
 * string or a reference has nothing to judge.
 */
function scopeOf(paths: readonly string[]): string[] {
	const parents = paths.map((path) => path.split(".").slice(0, -1));
	const [first = []] = parents;
	let length = 0;
	while (
		length < first.length &&
		parents.every((parent) => parent[length] === first[length])
	) {
		length++;
	}
	return first.slice(0, length);
}

/** Whether `parents` then `key`, below `owner`, reach a value that is not empty. */
function reaches(
	owner: Data,
	parents: readonly string[],
	key: string,
): boolean {
	return walk(owner, parents).some((parent) => !isEmpty(parent[key]));
}

/** The owners where none of the alternatives has a value. */
function missing(node: Data, requirement: Requirement): Data[] {
	const paths = typeof requirement === "string" ? [requirement] : requirement;
	const scope = scopeOf(paths);
	return walk(node, scope).filter(
		(owner) =>
			!paths.some((path) =>
				reaches(
					owner,
					path.split(".").slice(scope.length, -1),
					path.slice(path.lastIndexOf(".") + 1),
				),
			),
	);
}

const name = (requirement: Requirement) =>
	typeof requirement === "string" ? requirement : requirement.join(" or ");

const warned = new Set<string>();

function defaultWarning(warning: RequirementWarning): void {
	// The key is a rule's type, property and code — a fixed set, never data.
	const key = `${warning.type}|${warning.property}|${warning.code}`;
	if (warned.has(key)) return;
	warned.add(key);
	console.warn(`[ephemeris] ${warning.message} — ${warning.source}`);
}

/** Hands a warning to the caller's handler, or writes it once. */
export function emitWarning(
	options: CheckOptions,
	warning: RequirementWarning,
): void {
	(options.onWarning ?? defaultWarning)(warning);
}

/** Checks `node` against `rule`; throws on a missing required property. */
export function check(
	rule: Rule,
	node: Data,
	options: CheckOptions = {},
): void {
	const onWarning = (warning: RequirementWarning) =>
		emitWarning(options, warning);
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
		if (missing(node, required).length > 0) report.fail(name(required));
	}
	for (const recommended of rule.recommended ?? []) {
		missing(node, recommended).forEach(() => {
			report.warn(
				"W_EPHEMERIS_MISSING_RECOMMENDED",
				name(recommended),
				`${rule.type} has no ${name(recommended)}, which Google recommends`,
			);
		});
	}
	for (const extra of rule.checks ?? []) extra(node, report);
}
