import { describe, expect, it } from "vitest";
import { generateSchema, typeName } from "../../scripts/schema-generator.js";

/** A release in miniature: just what each rule of the generator needs. */
const vocabulary = {
	"@graph": [
		42,
		{ "@id": 7, "@type": "rdfs:Class" },
		{ "@id": "bibo:Book", "@type": "rdfs:Class" },
		{
			"@id": "schema:Thing",
			"@type": "rdfs:Class",
			"rdfs:comment": {
				"@value":
					'The most generic type. See [[name]] or <a href="https://schema.org">the <b>site</b></a>.<br/>Next line.<li>item</li> Ends */ here.',
			},
		},
		{
			"@id": "schema:Widget",
			"@type": "rdfs:Class",
			"rdfs:subClassOf": [
				{ "@id": "schema:Thing" },
				{ "@id": "schema:Ghost" },
				"loose",
				{ "@id": 5 },
			],
		},
		{ "@id": "schema:Silent", "@type": "rdfs:Class", "rdfs:comment": 12 },
		{
			"@id": "schema:OldWidget",
			"@type": "rdfs:Class",
			"rdfs:subClassOf": { "@id": "schema:Widget" },
			"schema:supersededBy": { "@id": "schema:Widget" },
			"schema:isPartOf": { "@id": "https://pending.schema.org" },
		},
		{
			"@id": "schema:AutoWidget",
			"@type": "rdfs:Class",
			"rdfs:subClassOf": { "@id": "schema:Widget" },
			"schema:isPartOf": { "@id": "https://auto.schema.org" },
		},
		{
			"@id": "schema:Colour",
			"@type": "rdfs:Class",
			"rdfs:subClassOf": { "@id": "schema:Thing" },
		},
		{ "@id": "schema:Red", "@type": ["schema:Colour", "owl:NamedIndividual"] },
		{ "@id": "schema:Text", "@type": ["rdfs:Class", "schema:DataType"] },
		{
			"@id": "schema:name",
			"@type": "rdf:Property",
			"rdfs:comment": "The name.",
			"schema:domainIncludes": { "@id": "schema:Thing" },
			"schema:rangeIncludes": { "@id": "schema:Text" },
		},
		{
			"@id": "schema:colour",
			"@type": "rdf:Property",
			"rdfs:comment": "A colour.",
			"schema:domainIncludes": { "@id": "schema:Widget" },
			"schema:rangeIncludes": { "@id": "schema:Colour" },
			"schema:supersededBy": { "@id": "schema:name" },
		},
		{
			"@id": "schema:void",
			"@type": "rdf:Property",
			"schema:domainIncludes": { "@id": "schema:Widget" },
			"schema:rangeIncludes": { "@id": "schema:Nowhere" },
		},
	],
};

describe("ephemeris > the schema generator", () => {
	const out = generateSchema(vocabulary);

	it("refuses what is not a release", () => {
		expect(() => generateSchema([])).toThrow(/no @graph/);
		expect(() => generateSchema({ "@graph": {} })).toThrow(/no @graph/);
	});

	it("generates schema: terms only, skipping malformed nodes", () => {
		expect(out).not.toMatch(/bibo|Book/);
		expect(out).toContain(
			"export type Widget = WidgetLeaf | AutoWidget | OldWidget;",
		);
		expect(out).toContain("interface WidgetBase extends ThingBase {");
	});

	it("writes schema.org's comments as JSDoc", () => {
		expect(out).toContain("{@link https://schema.org/name name}");
		expect(out).toContain("{@link https://schema.org the site}");
		expect(out).toContain(" * Next line.");
		expect(out).toContain("*\\/ here.");
		// A class with no comment and nothing to note gets no doc at all.
		expect(out).toMatch(/\n\ninterface SilentBase/);
	});

	it("notes pending, extension and superseded terms", () => {
		expect(out).toContain("Pending: proposed for schema.org");
		expect(out).toContain(
			"Part of the {@link https://auto.schema.org} extension.",
		);
		expect(out).toContain(
			"@deprecated Use {@link https://schema.org/Widget Widget} instead.",
		);
		expect(out).toContain(
			"@deprecated Consider using {@link https://schema.org/name name} instead.",
		);
	});

	it("types enumerations, ranges and a range that names nothing", () => {
		expect(out).toContain(
			'export type Colour = "https://schema.org/Red" | "Red" | ColourLeaf;',
		);
		expect(out).toContain(
			'"colour"?: SchemaValue<Colour | IdReference, "colour">;',
		);
		expect(out).toContain('"void"?: SchemaValue<never, "void">;');
	});

	it("names a term that starts with a digit", () => {
		expect(typeName("3DModel")).toBe("_3DModel");
		expect(typeName("Web-Page")).toBe("Web_Page");
	});
});
