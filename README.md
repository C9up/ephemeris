# @c9up/ephemeris

schema.org structured data for the Ream ecosystem: it describes a page to
search engines in JSON-LD.

- the whole schema.org vocabulary, typed, generated from the official file;
- an `@graph` of linked entities, with stable `@id`s and no duplicates;
- a `<script type="application/ld+json">` whose content cannot close the tag,
  carrying the request's CSP nonce;
- Google's rich-result requirements checked: a missing required property is
  an error, a missing recommended one a warning.

No dependencies at run time.

Not yet published: the package is being built.

## Types

Every schema.org type and property, from release 30.1:

```ts
import type { Product, WithContext } from '@c9up/ephemeris/schema'
// or: import type { Schema } from '@c9up/ephemeris' — Schema.Product

const product: WithContext<Product> = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Executive Anvil',
  offers: { '@type': 'Offer', price: '119.99', priceCurrency: 'CHF', availability: 'InStock' },
}
```

A property takes one value or an array, a `Role`, or an `{ '@id' }`
reference; an enumeration takes its member's URL or short name; an unknown
property, a wrong `@type` or a value outside a property's range does not
compile. The types are generated from the release file in `vocabulary/` —
`pnpm generate:schema` — and compile to no code.

## License

MIT, except the schema.org vocabulary and the types generated from it
(`src/schema.ts`), which are CC BY-SA 3.0 — see NOTICE.
