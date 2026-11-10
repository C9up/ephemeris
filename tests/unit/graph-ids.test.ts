import { describe, expect, it } from "vitest";
import { EphemerisError, SchemaGraph } from "../../src/index.js";

/**
 * An `@id` the graph handed out is that node's. A caller's own id — an
 * `options.id` or an `@id` — that lands on it names another node, so it is
 * refused rather than merged into the first: merging gave one node two
 * people's properties and lost the other entirely.
 */

const PAGE = "https://a.example/p";

function refusal(build: () => unknown): EphemerisError {
	try {
		build();
	} catch (error) {
		if (error instanceof EphemerisError) return error;
		throw error;
	}
	throw new Error("expected a refusal");
}

function ids(graph: SchemaGraph): unknown[] {
	return graph
		.toJsonLd()
		["@graph"].map((node) => Reflect.get(Object(node), "@id"));
}

describe("ephemeris > graph > @ids it handed out", () => {
	it("refuses an options.id equal to a rank given to another node", () => {
		const graph = new SchemaGraph({ url: PAGE }).add({
			"@type": "Person",
			name: "Alice",
		});
		const error = refusal(() =>
			graph.add({ "@type": "Person", name: "Bob", email: "bob@x" }, { id: 1 }),
		);
		expect(error.code).toBe("E_EPHEMERIS_ID_TAKEN");
		expect(error.message).toContain(`${PAGE}#/schema/person/1`);
		// Alice is untouched.
		expect(graph.toJsonLd()["@graph"]).toEqual([
			{ "@type": "Person", "@id": `${PAGE}#/schema/person/1`, name: "Alice" },
		]);
	});

	it("refuses a given @id equal to a rank given to another node", () => {
		const graph = new SchemaGraph({ url: PAGE }).add({
			"@type": "Person",
			name: "Alice",
		});
		for (const id of ["#/schema/person/1", `${PAGE}#/schema/person/1`]) {
			expect(
				refusal(() => graph.add({ "@type": "Person", "@id": id, name: "Bob" }))
					.code,
			).toBe("E_EPHEMERIS_ID_TAKEN");
		}
	});

	it("refuses a slot node whose @id is a rank given to another node", () => {
		const graph = new SchemaGraph({ url: PAGE }).add({
			"@type": "Person",
			name: "Alice",
		});
		expect(
			refusal(() =>
				graph.mainEntity({
					"@type": "Person",
					"@id": "#/schema/person/1",
					name: "Bob",
				}),
			).code,
		).toBe("E_EPHEMERIS_ID_TAKEN");
	});

	it("skips, for a new rank, an id a caller already took by @id", () => {
		const graph = new SchemaGraph({ url: PAGE })
			.add({ "@type": "Person", "@id": "#/schema/person/1", name: "Alice" })
			.add({ "@type": "Person", name: "Bob" });
		expect(ids(graph)).toEqual([
			`${PAGE}#/schema/person/1`,
			`${PAGE}#/schema/person/2`,
		]);
	});

	it("still layers the same id given twice", () => {
		const graph = new SchemaGraph({ url: PAGE })
			.add({ "@type": "Person", name: "Ada" }, { id: "x" })
			.add({ "@type": "Person", email: "ada@x" }, { id: "x" })
			.add({ "@type": "Person", "@id": "#author", name: "B" })
			.add({ "@type": "Person", "@id": "#author", jobTitle: "Writer" });
		expect(graph.toJsonLd()["@graph"]).toEqual([
			{
				"@type": "Person",
				"@id": `${PAGE}#/schema/person/x`,
				email: "ada@x",
				name: "Ada",
			},
			{
				"@type": "Person",
				"@id": `${PAGE}#author`,
				jobTitle: "Writer",
				name: "B",
			},
		]);
	});
});
