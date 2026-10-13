/**
 * The entities of a page as one `@graph`: the site's identity, the website,
 * the page, its breadcrumb and its main entity, linked by `@id`.
 *
 *   const graph = new SchemaGraph({ url: "https://shop.example/anvil" })
 *   graph.identity({ "@type": "Organization", name: "ACME" })
 *   graph.website({ "@type": "WebSite", name: "ACME shop" })
 *   graph.webPage({ "@type": "ItemPage", name: "Anvil" })
 *   graph.mainEntity({ "@type": "Product", name: "Anvil" })
 *   jsonLdScriptTag(graph.toJsonLd(), { nonce })
 *
 * The `@id` scheme is @unhead/schema-org's (3.4.3, read from its tarball):
 * fixed fragments for the page's root nodes, `#/schema/<type>/<n>` for the
 * others. What it does not take from there: a node's role is the slot it was
 * put in, never guessed from its `@type`; and no value is invented — no
 * default availability, no truncated headline. A link is added only between
 * two nodes that are both there, and never over one the caller set.
 *
 * Several layers (a layout, then the page) may describe the same node: the
 * declarations merge, the `@type`s are united, and a property the later layer
 * sets wins.
 */

import { type Data, isPlainObject } from "./data.js";
import { EphemerisError } from "./errors.js";
import type {
	BreadcrumbList,
	Organization,
	Person,
	Thing,
	WebPage,
	WebSite,
} from "./schema.js";

export interface SchemaGraphOptions {
	/** The page's absolute URL: the base of its nodes' `@id`s. */
	url: string;
	/** The site's home, base of the identity's and website's `@id`s; the URL's origin by default. */
	site?: string;
}

/** A node as given: an object with its type. */
type Node = Exclude<Thing, string>;

type Slot = "identity" | "website" | "webPage" | "breadcrumb" | "mainEntity";

/** The graph lists the root nodes first, in this order. */
const SLOT_ORDER: readonly Slot[] = [
	"identity",
	"website",
	"webPage",
	"breadcrumb",
	"mainEntity",
];

/** Where each root node lives. */
const SLOTS: Record<Slot, { on: "site" | "page"; fragment: string }> = {
	identity: { on: "site", fragment: "#identity" },
	website: { on: "site", fragment: "#website" },
	webPage: { on: "page", fragment: "#webpage" },
	breadcrumb: { on: "page", fragment: "#breadcrumb" },
	mainEntity: { on: "page", fragment: "#main-entity" },
};

/** Keys that would reach a prototype if a merge ever assigned them. */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function absoluteHttp(value: string, what: string): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_URL",
			`${what} must be an absolute URL, not "${value}"`,
		);
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_URL",
			`${what} must be an http(s) URL, not "${value}"`,
		);
	}
	url.hash = "";
	return url;
}

/** A value with its empty parts removed: `undefined`, `null`, `""`, `[]`, `{}`. */
function clean(value: unknown, path: string): unknown {
	if (value === undefined || value === null || value === "") return undefined;
	if (Array.isArray(value)) {
		const items = value
			.map((item, index) => clean(item, `${path}[${index}]`))
			.filter((item) => item !== undefined);
		return items.length === 0 ? undefined : items;
	}
	if (!isPlainObject(value)) return value;
	const entries: [string, unknown][] = [];
	for (const [key, item] of Object.entries(value)) {
		if (UNSAFE_KEYS.has(key)) {
			throw new EphemerisError(
				"E_EPHEMERIS_UNSAFE_KEY",
				`${path}.${key} is not a key structured data may use`,
			);
		}
		const cleaned = clean(item, `${path}.${key}`);
		if (cleaned !== undefined) entries.push([key, cleaned]);
	}
	return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

function typesOf(node: Data): [string, ...string[]] {
	const type = node["@type"];
	const [first, ...rest] = (Array.isArray(type) ? type : [type]).filter(
		(entry): entry is string => typeof entry === "string" && entry !== "",
	);
	if (first === undefined) {
		throw new EphemerisError(
			"E_EPHEMERIS_INVALID_NODE",
			'a node needs an "@type"',
		);
	}
	return [first, ...rest];
}

/** `LocalBusiness` → `local-business`, `3DModel` → `3d-model`. */
function kebab(type: string): string {
	return type
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/([A-Z0-9]+)([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

/** `@type` and `@id` first, then the rest by name: the same bytes every time. */
function ordered(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(ordered);
	if (!isPlainObject(value)) return value;
	const keys = Object.keys(value).sort((a, b) => {
		const rank = (key: string) =>
			key === "@type" ? 0 : key === "@id" ? 1 : key.startsWith("@") ? 2 : 3;
		// Keys are unique, so two of them are never equal.
		return rank(a) - rank(b) || (a < b ? -1 : 1);
	});
	return Object.fromEntries(keys.map((key) => [key, ordered(value[key])]));
}

const reference = (id: string) => ({ "@id": id });

export class SchemaGraph {
	readonly #page: URL;
	readonly #site: URL;
	/** Nodes by `@id`, in the order they were first declared. */
	readonly #nodes = new Map<string, Data>();
	readonly #slots = new Map<Slot, string>();
	readonly #ranks = new Map<string, number>();

	constructor(options: SchemaGraphOptions) {
		this.#page = absoluteHttp(options.url, "the page URL");
		this.#site = absoluteHttp(
			options.site ?? this.#page.origin,
			"the site URL",
		);
	}

	/** The organization or person behind the site: `<site>#identity`. */
	identity(
		node: Exclude<Organization, string> | Exclude<Person, string>,
	): this {
		return this.#put("identity", node);
	}

	/** The website: `<site>#website`, published by the identity. */
	website(node: Exclude<WebSite, string>): this {
		return this.#put("website", node);
	}

	/** This page: `<url>#webpage`, part of the website. */
	webPage(node: Exclude<WebPage, string>): this {
		return this.#put("webPage", node);
	}

	/** The page's breadcrumb: `<url>#breadcrumb`. */
	breadcrumb(node: Exclude<BreadcrumbList, string>): this {
		return this.#put("breadcrumb", node);
	}

	/** What the page is about — a product, an article: `<url>#main-entity`. */
	mainEntity(node: Node): this {
		return this.#put("mainEntity", node);
	}

	/**
	 * Any other node. It keeps an absolute `@id` it has, or a relative one
	 * resolved against the page; otherwise it gets `<url>#/schema/<type>/<id>`,
	 * with `options.id` or its rank among the nodes of its type.
	 */
	add(node: Node, options: { id?: string | number } = {}): this {
		const data = this.#clean(node);
		const types = typesOf(data);
		const given = data["@id"];
		let id: string;
		if (typeof given === "string") {
			id = new URL(given, this.#page).href;
		} else {
			const type = kebab(types[0]);
			const rank = this.#ranks.get(type) ?? 0;
			if (options.id === undefined) this.#ranks.set(type, rank + 1);
			const suffix = options.id === undefined ? rank + 1 : options.id;
			id = `${this.#page.href}#/schema/${type}/${encodeURIComponent(String(suffix))}`;
		}
		this.#merge(id, data);
		return this;
	}

	/** The graph, ready for `jsonLdScriptTag` or `toJsonLd`. */
	toJsonLd(): { "@context": "https://schema.org"; "@graph": unknown[] } {
		const nodes = new Map(
			[...this.#nodes].map(([id, node]) => [id, { ...node }]),
		);
		const slot = (name: Slot) => {
			const id = this.#slots.get(name);
			return id === undefined ? undefined : nodes.get(id);
		};
		const link = (from: Data | undefined, key: string, to: Slot) => {
			const target = this.#slots.get(to);
			if (
				from === undefined ||
				target === undefined ||
				Object.hasOwn(from, key)
			)
				return;
			from[key] = reference(target);
		};
		link(slot("website"), "publisher", "identity");
		link(slot("webPage"), "isPartOf", "website");
		link(slot("webPage"), "breadcrumb", "breadcrumb");
		link(slot("webPage"), "mainEntity", "mainEntity");
		link(slot("mainEntity"), "mainEntityOfPage", "webPage");

		const roots = SLOT_ORDER.flatMap((name) => {
			const id = this.#slots.get(name);
			return id === undefined ? [] : [id];
		});
		const order = [
			...roots,
			...[...nodes.keys()].filter((id) => !roots.includes(id)),
		];
		return {
			"@context": "https://schema.org",
			"@graph": order.map((id) => ordered(nodes.get(id))),
		};
	}

	#put(name: Slot, node: Node): this {
		const data = this.#clean(node);
		typesOf(data);
		const given = data["@id"];
		const { on, fragment } = SLOTS[name];
		const base = on === "site" ? this.#site : this.#page;
		const id =
			this.#slots.get(name) ??
			(typeof given === "string"
				? new URL(given, this.#page).href
				: `${base.href}${fragment}`);
		this.#slots.set(name, id);
		this.#merge(id, data);
		return this;
	}

	#clean(node: Node): Data {
		if (!isPlainObject(node)) {
			throw new EphemerisError(
				"E_EPHEMERIS_INVALID_NODE",
				"a node must be a plain object",
			);
		}
		const cleaned = clean(node, "node");
		return isPlainObject(cleaned) ? cleaned : {};
	}

	#merge(id: string, data: Data): void {
		const existing = this.#nodes.get(id);
		const types = [
			...new Set([
				...(existing === undefined ? [] : typesOf(existing)),
				...typesOf(data),
			]),
		];
		const merged: Data = Object.fromEntries([
			...Object.entries(existing ?? {}),
			...Object.entries(data),
		]);
		merged["@type"] = types.length === 1 ? types[0] : types;
		merged["@id"] = id;
		this.#nodes.set(id, merged);
	}
}
