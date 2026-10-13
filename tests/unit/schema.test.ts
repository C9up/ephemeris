import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
	generateSchema,
	VOCABULARY_FILE,
	VOCABULARY_VERSION,
} from "../../scripts/schema-generator.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const schemaFile = `${root}src/schema.ts`;
const generated = readFileSync(schemaFile, "utf8");
const vocabulary: unknown = JSON.parse(
	readFileSync(`${root}${VOCABULARY_FILE}`, "utf8"),
);

/** Compiles snippets against the generated types; the errors of each. */
function diagnose(snippets: Record<string, string>): Record<string, string[]> {
	const options: ts.CompilerOptions = {
		strict: true,
		noEmit: true,
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.NodeNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
		skipLibCheck: true,
		types: [],
	};
	const virtual = new Map(
		Object.entries(snippets).map(([name, code]) => [
			`${root}tests/__snippets__/${name}.ts`,
			`import type * as S from "../../src/schema.js";\n${code}\n`,
		]),
	);
	const host = ts.createCompilerHost(options);
	const getSourceFile = host.getSourceFile.bind(host);
	host.getSourceFile = (fileName, language, onError, shouldCreate) => {
		const code = virtual.get(fileName);
		return code === undefined
			? getSourceFile(fileName, language, onError, shouldCreate)
			: ts.createSourceFile(fileName, code, language);
	};
	const fileExists = host.fileExists.bind(host);
	host.fileExists = (fileName) => virtual.has(fileName) || fileExists(fileName);
	const program = ts.createProgram([...virtual.keys()], options, host);
	const result: Record<string, string[]> = {};
	for (const [fileName] of virtual) {
		const name = fileName.slice(fileName.lastIndexOf("/") + 1, -3);
		result[name] = ts
			.getPreEmitDiagnostics(program, program.getSourceFile(fileName))
			.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
	}
	return result;
}

describe("ephemeris > schema.org types", () => {
	it(`is generated from release ${VOCABULARY_VERSION}, and up to date`, () => {
		expect(generated).toBe(generateSchema(vocabulary));
		expect(generated).toContain(`release ${VOCABULARY_VERSION}`);
	});

	it("types every schema.org class, and nothing from another vocabulary", () => {
		const graph =
			typeof vocabulary === "object" &&
			vocabulary !== null &&
			"@graph" in vocabulary &&
			Array.isArray(vocabulary["@graph"])
				? vocabulary["@graph"]
				: [];
		const classes = graph.filter(
			(node: { "@id"?: unknown; "@type"?: unknown }) =>
				typeof node["@id"] === "string" &&
				node["@id"].startsWith("schema:") &&
				[node["@type"]].flat().includes("rdfs:Class"),
		);
		const helpers = new Set([
			"WithContext",
			"MergeLeafTypes",
			"WithActionConstraints",
		]);
		// Every class is one exported type; a role's leaf is a generic type too.
		const exported = [...generated.matchAll(/^export type (\w+)\b/gm)]
			.map(([, name]) => name ?? "")
			.filter((name) => !helpers.has(name) && !name.endsWith("Leaf"));
		const expected = classes.map((node: { "@id": string }) => {
			const name = node["@id"].slice("schema:".length);
			return /^[0-9]/.test(name) ? `_${name}` : name;
		});
		expect(new Set(exported)).toEqual(new Set(expected));
		expect(exported).toHaveLength(expected.length);
		expect(generated).not.toMatch(/purl_|StupidType|bibo|fibo|cmns/);
	});

	it("compiles to no code at all", () => {
		const output = ts.transpileModule(generated, {
			compilerOptions: {
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ES2022,
			},
		}).outputText;
		const code = output
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/\/\/.*$/gm, "")
			.trim();
		expect(code).toBe("export {};");
	});

	it("accepts what schema.org allows and refuses the rest", () => {
		const errors = diagnose({
			valid: `export const p: S.Product = { "@type": "Product", name: "Anvil", offers: { "@type": "Offer", price: 12, availability: "InStock" } };`,
			misspelt: `export const p: S.Product = { "@type": "Product", nmae: "Anvil" };`,
			wrongType: `export const p: S.Product = { "@type": "Person", name: "Ada" };`,
			notMember: `export const a: S.ItemAvailability = "InStok";`,
			wrongRange: `export const p: S.Product = { "@type": "Product", offers: 42 };`,
			plainProduct: `export const p: S.Product = "Anvil";`,
			wrongEnumInNode: `export const o: S.Offer = { "@type": "Offer", availability: "Maybe" };`,
		});
		expect(errors.valid).toEqual([]);
		expect(errors.misspelt?.join()).toMatch(/nmae/);
		expect(errors.wrongType?.join()).toMatch(/"Person"/);
		expect(errors.notMember?.join()).toMatch(/InStok/);
		expect(errors.wrongRange?.join()).toMatch(/number/);
		expect(errors.plainProduct?.join()).toMatch(/string/);
		expect(errors.wrongEnumInNode?.join()).toMatch(/Maybe/);
	});
});
