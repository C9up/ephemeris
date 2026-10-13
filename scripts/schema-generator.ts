/**
 * The types of the whole schema.org vocabulary, written from a release file:
 * what `scripts/generate-schema.ts` writes to `src/schema.ts`.
 *
 * The shape is schema-dts's (2.1.0, read from its tarball): for each class an
 * `XBase` holding its properties, an `XLeaf` with its literal `@type`, and `X`,
 * the union of its leaf, its subclasses and, for an enumeration, its members.
 * Every value is one value or an array, and may be an `{ "@id" }` reference.
 *
 * Only `schema:` terms are generated: the release also maps external
 * vocabularies (bibo, OMG Commons, FIBO…), which are not schema.org.
 */

/** The release the types are generated from. */
export const VOCABULARY_VERSION = "30.1";
export const VOCABULARY_FILE = `vocabulary/schemaorg-${VOCABULARY_VERSION}-current-https.jsonld`;

interface Term {
	id: string;
	name: string;
	types: string[];
	comment: string;
	parents: string[];
	domains: string[];
	ranges: string[];
	supersededBy: string[];
	partOf: string | undefined;
}

/** Data types whose values are JSON primitives, and what they are. */
const PRIMITIVES: Record<string, string> = {
	Boolean: "boolean",
	Date: "string",
	DateTime: "string",
	Number: `number | \`\${number}\``,
	Quantity: "string",
	Text: "string",
	Time: "string",
};

/** Classes a plain string may stand for (a name, a URL), as in schema-dts. */
const ALSO_STRING = new Set(["EntryPoint", "Organization", "Person", "Place"]);

/** Role and its subclasses: generic over the value and property they wrap. */
const ROLE_ROOT = "Role";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list(value: unknown): unknown[] {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

/** The `@id`s of a JSON-LD value, one node or many. */
function ids(value: unknown): string[] {
	return list(value).flatMap((entry) => {
		if (!isRecord(entry)) return [];
		const id = entry["@id"];
		return typeof id === "string" ? [id] : [];
	});
}

function strings(value: unknown): string[] {
	return list(value).filter((entry) => typeof entry === "string");
}

function text(value: unknown): string {
	if (typeof value === "string") return value;
	if (isRecord(value) && typeof value["@value"] === "string")
		return value["@value"];
	return "";
}

const SCHEMA = "schema:";

function local(id: string): string {
	return id.slice(SCHEMA.length);
}

function readTerms(vocabulary: unknown): Map<string, Term> {
	if (!isRecord(vocabulary) || !Array.isArray(vocabulary["@graph"])) {
		throw new Error("not a schema.org release: no @graph");
	}
	const terms = new Map<string, Term>();
	for (const node of vocabulary["@graph"]) {
		if (!isRecord(node)) continue;
		const id = node["@id"];
		if (typeof id !== "string" || !id.startsWith(SCHEMA)) continue;
		const schemaIds = (value: unknown) =>
			ids(value)
				.filter((entry) => entry.startsWith(SCHEMA))
				.map(local);
		terms.set(local(id), {
			id,
			name: local(id),
			types: strings(node["@type"]),
			comment: text(node["rdfs:comment"]),
			parents: schemaIds(node["rdfs:subClassOf"]),
			domains: schemaIds(node["schema:domainIncludes"]),
			ranges: schemaIds(node["schema:rangeIncludes"]),
			supersededBy: schemaIds(node["schema:supersededBy"]),
			partOf: ids(node["schema:isPartOf"])[0],
		});
	}
	return terms;
}

/** A TypeScript name for a term: `3DModel` cannot start an identifier. */
export function typeName(name: string): string {
	const sanitized = name.replace(/[^A-Za-z0-9_]/g, "_");
	return /^[0-9]/.test(sanitized) ? `_${sanitized}` : sanitized;
}

/** schema.org's comment markup as JSDoc: links kept, tags dropped. */
function toJsDoc(term: Term, indent: string, notes: string[]): string {
	const body = term.comment
		.replace(/\[\[([^\]]+)\]\]/g, "{@link https://schema.org/$1 $1}")
		.replace(
			/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
			(_match, href: string, label: string) =>
				`{@link ${href} ${label.replace(/<[^>]+>/g, "").trim()}}`,
		)
		.replace(/<br\s*\/?>/g, "\n")
		.replace(/<\/?(p|li|ul|ol)\b[^>]*>/g, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/\\n/g, "\n")
		.replace(/\*\//g, "*\\/")
		.trim();
	const paragraphs = [body, ...notes].filter((part) => part.length > 0);
	if (paragraphs.length === 0) return "";
	const lines = paragraphs.join("\n\n").split("\n");
	if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`;
	return `${indent}/**\n${lines
		.map((line) => (line.trim() === "" ? `${indent} *` : `${indent} * ${line}`))
		.join("\n")}\n${indent} */\n`;
}

function notesOf(term: Term, verb: "Use" | "Consider using"): string[] {
	const notes: string[] = [];
	if (term.partOf === "https://pending.schema.org") {
		notes.push(
			"Pending: proposed for schema.org, not yet part of its core ({@link https://pending.schema.org}).",
		);
	} else if (term.partOf !== undefined) {
		notes.push(`Part of the {@link ${term.partOf}} extension.`);
	}
	if (term.supersededBy.length > 0) {
		notes.push(
			`@deprecated ${verb} ${term.supersededBy
				.map((name) => `{@link https://schema.org/${name} ${name}}`)
				.join(" or ")} instead.`,
		);
	}
	return notes;
}

/** Code-point order: the same on every machine, unlike a locale compare. */
const byName = (a: string, b: string) => Number(a > b) - Number(a < b);

/** Generates `src/schema.ts` from a schema.org release (its JSON-LD). */
export function generateSchema(vocabulary: unknown): string {
	const terms = readTerms(vocabulary);
	const isClass = (term: Term) => term.types.includes("rdfs:Class");
	const classes = [...terms.values()].filter(isClass);
	const classNames = new Set(classes.map((term) => term.name));
	const properties = [...terms.values()].filter((term) =>
		term.types.includes("rdf:Property"),
	);

	const childrenOf = new Map<string, string[]>();
	for (const term of classes) {
		for (const parent of term.parents) {
			if (!classNames.has(parent)) continue;
			childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), term.name]);
		}
	}

	// Enumeration members: a term typed with a class that is not itself a class.
	const membersOf = new Map<string, string[]>();
	for (const term of terms.values()) {
		if (isClass(term) || term.types.includes("rdf:Property")) continue;
		for (const type of term.types) {
			if (!type.startsWith(SCHEMA)) continue;
			const owner = local(type);
			membersOf.set(owner, [...(membersOf.get(owner) ?? []), term.name]);
		}
	}

	const propsOf = new Map<string, Term[]>();
	for (const property of properties) {
		for (const domain of property.domains) {
			propsOf.set(domain, [...(propsOf.get(domain) ?? []), property]);
		}
	}

	const dataTypes = new Set(
		classes
			.filter((term) => term.types.includes("schema:DataType"))
			.map((term) => term.name),
	);
	const primitiveOf = (
		name: string,
		seen = new Set<string>(),
	): string | undefined => {
		if (seen.has(name)) return undefined;
		seen.add(name);
		const own = PRIMITIVES[name];
		if (own !== undefined) return own;
		for (const parent of terms.get(name)?.parents ?? []) {
			const found = primitiveOf(parent, seen);
			if (found !== undefined) return found;
		}
		return undefined;
	};
	const isRole = (name: string, seen = new Set<string>()): boolean => {
		if (name === ROLE_ROOT) return true;
		if (seen.has(name)) return false;
		seen.add(name);
		return (terms.get(name)?.parents ?? []).some((parent) =>
			isRole(parent, seen),
		);
	};
	/**
	 * Has a leaf: a node of its own. A data type, and a subclass of one with no
	 * property of its own (URL, Distance…), is only its primitive.
	 */
	const isNode = (name: string): boolean =>
		primitiveOf(name) === undefined || (propsOf.get(name)?.length ?? 0) > 0;

	const out: string[] = [];
	out.push(`/**
 * The schema.org vocabulary, release ${VOCABULARY_VERSION}, as TypeScript types.
 *
 * GENERATED by scripts/generate-schema.ts from ${VOCABULARY_FILE}:
 * do not edit; regenerate with \`pnpm generate:schema\`.
 *
 * The descriptions are schema.org's, © the schema.org sponsors, licensed under
 * Creative Commons Attribution-ShareAlike 3.0
 * (https://creativecommons.org/licenses/by-sa/3.0/); see NOTICE.
 */

/** A minimal JSON-LD object: a type, and the IRI it may be known by. */
export interface JsonLdObject {
	readonly "@type": string | readonly string[];
	readonly "@id"?: string;
}

/** A reference to a node described elsewhere: \`{ "@id": "https://…#org" }\`. */
export interface IdReference {
	readonly "@id": string;
}

/** A top-level node, with the context that gives its keys their meaning. */
export type WithContext<T extends JsonLdObject | string> = T & {
	"@context": "https://schema.org";
};

/** Several nodes in one document, linked by their \`@id\`s. */
export interface Graph {
	"@context": "https://schema.org";
	"@graph": readonly Thing[];
}

/** One value or several, each possibly wrapped in a Role. */
type SchemaValue<T, TProperty extends string> =
	| T
	| Role<T, TProperty>
	| readonly (T | Role<T, TProperty>)[];

interface LeafLike {
	"@type": string;
}
type UnionToIntersection<T> = (
	T extends unknown ? (value: T) => void : never
) extends (value: infer I) => void
	? I
	: never;
type OmitTypeProperty<T extends LeafLike> = T extends unknown
	? Omit<T, "@type">
	: never;

/**
 * One node of several types — \`MergeLeafTypes<[ProductLeaf, SoftwareApplicationLeaf]>\`
 * — with a tuple-valued \`@type\`.
 */
export type MergeLeafTypes<T extends readonly [LeafLike, ...LeafLike[]]> =
	UnionToIntersection<OmitTypeProperty<T[number]>> & {
		"@type": { [K in keyof T]: T[K] extends { "@type": infer U } ? U : never };
	};

type InputActionConstraints<T extends ActionBase> = Partial<{
	[K in Exclude<keyof T, \`@\${string}\`> as \`\${string & K}-input\`]:
		| PropertyValueSpecification
		| string;
}>;
type OutputActionConstraints<T extends ActionBase> = Partial<{
	[K in Exclude<keyof T, \`@\${string}\`> as \`\${string & K}-output\`]:
		| PropertyValueSpecification
		| string;
}>;

/** An action with its input and output constraints (\`query-input\`…). */
export type WithActionConstraints<T extends ActionBase> = T &
	InputActionConstraints<T> &
	OutputActionConstraints<T>;
`);

	const propertyType = (property: Term): string => {
		const names = [...new Set(property.ranges)]
			.filter((range) => classNames.has(range))
			.map(typeName)
			.sort(byName);
		if (
			property.ranges.some((range) => classNames.has(range) && isNode(range))
		) {
			names.push("IdReference");
		}
		return names.length === 0 ? "never" : names.join(" | ");
	};

	const baseOf = (term: Term): string => {
		const name = typeName(term.name);
		const parents = term.parents
			.filter((parent) => classNames.has(parent) && isNode(parent))
			.map((parent) => `${typeName(parent)}Base`);
		const heritage =
			parents.length > 0 ? parents.join(", ") : "Partial<IdReference>";
		const props = [...(propsOf.get(term.name) ?? [])].sort((a, b) =>
			byName(a.name, b.name),
		);
		const members = props
			.map(
				(property) =>
					`${toJsDoc(property, "\t", notesOf(property, "Consider using"))}\t"${property.name}"?: SchemaValue<${propertyType(property)}, "${property.name}">;\n`,
			)
			.join("");
		return `interface ${name}Base extends ${heritage} {\n${members}}\n`;
	};

	for (const term of [...classes].sort((a, b) => byName(a.name, b.name))) {
		const name = typeName(term.name);
		const doc = toJsDoc(term, "", notesOf(term, "Use"));
		const children = [...(childrenOf.get(term.name) ?? [])].sort(byName);
		const members = [...(membersOf.get(term.name) ?? [])]
			.filter((member) => !classNames.has(member))
			.sort(byName)
			.flatMap((member) => [`"https://schema.org/${member}"`, `"${member}"`]);
		const primitive = primitiveOf(term.name);

		if (term.name === "DataType") {
			out.push(
				`${doc}export type DataType = ${[...dataTypes].sort(byName).map(typeName).join(" | ")};\n`,
			);
			continue;
		}

		if (isRole(term.name)) {
			out.push(baseOf(term));
			out.push(
				`export type ${name}Leaf<TContent, TProperty extends string> = Omit<${name}Base, TProperty> & {\n\t"@type": "${term.name}";\n} & {\n\t[key in TProperty]: TContent;\n};\n`,
			);
			const union = [
				`${name}Leaf<TContent, TProperty>`,
				...children.map((child) => `${typeName(child)}<TContent, TProperty>`),
			];
			out.push(
				`${doc}export type ${name}<TContent = never, TProperty extends string = never> = ${union.join(" | ")};\n`,
			);
			continue;
		}

		const parts: string[] = [...members];
		if (isNode(term.name)) {
			out.push(baseOf(term));
			out.push(
				`export interface ${name}Leaf extends ${name}Base {\n\t"@type": "${term.name}";\n}\n`,
			);
			parts.push(`${name}Leaf`);
		}
		parts.push(...children.map(typeName));
		if (primitive !== undefined) parts.push(primitive);
		else if (ALSO_STRING.has(term.name)) parts.push("string");
		out.push(`${doc}export type ${name} = ${parts.join(" | ")};\n`);
	}

	return out.join("\n");
}
