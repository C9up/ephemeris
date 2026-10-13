/**
 * What the generated vocabulary accepts: checked by `tsc --noEmit -p .`,
 * never run. What it refuses is in tests/unit/schema.test.ts, compiled there
 * through the TypeScript API.
 */

import type {
	_3DModel,
	Graph,
	ItemAvailability,
	MergeLeafTypes,
	Organization,
	Person,
	Product,
	ProductLeaf,
	SearchActionLeaf,
	SoftwareApplicationLeaf,
	Thing,
	WebSite,
	WithActionConstraints,
	WithContext,
} from "../../src/schema.js";

export const product: WithContext<Product> = {
	"@context": "https://schema.org",
	"@type": "Product",
	"@id": "https://shop.example/p/1#product",
	name: "Executive Anvil",
	image: ["https://shop.example/anvil.jpg"],
	brand: { "@type": "Brand", name: "ACME" },
	offers: {
		"@type": "Offer",
		price: "119.99",
		priceCurrency: "CHF",
		availability: "https://schema.org/InStock",
	},
	aggregateRating: {
		"@type": "AggregateRating",
		ratingValue: 4.4,
		reviewCount: 89,
	},
};

// A subclass is a Thing, and a short enumeration member is accepted.
export const thing: Thing = { "@type": "LocalBusiness", name: "Bakery" };
export const availability: ItemAvailability = "InStock";

// Organization and Person may be a plain name.
export const publisher: Organization = "ACME SA";
export const author: Person = "Ada Lovelace";

// A reference instead of the node itself.
export const site: WebSite = {
	"@type": "WebSite",
	url: "https://shop.example",
	publisher: { "@id": "https://shop.example/#identity" },
};

export const graph: Graph = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "Organization",
			"@id": "https://shop.example/#identity",
			name: "ACME",
		},
		site,
	],
};

// A term that starts with a digit keeps its @type.
export const model: _3DModel = { "@type": "3DModel", name: "Anvil" };

// A role wraps a value with when and how it was held.
export const team: Organization = {
	"@type": "SportsTeam",
	member: {
		"@type": "OrganizationRole",
		member: { "@type": "Person", name: "Ada" },
		startDate: "2026-01-01",
		roleName: "Captain",
	},
};

// One node of two types.
export const app: MergeLeafTypes<[ProductLeaf, SoftwareApplicationLeaf]> = {
	"@type": ["Product", "SoftwareApplication"],
	name: "Anvil Pro",
	operatingSystem: "Linux",
};

// Action constraints: a site search box.
export const search: WithActionConstraints<SearchActionLeaf> = {
	"@type": "SearchAction",
	target: "https://shop.example/search?q={query}",
	"query-input": "required name=query",
};
