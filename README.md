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

## Google's requirements

```ts
import { breadcrumb, localBusiness, organization, website } from '@c9up/ephemeris'

graph
  .identity(localBusiness({ '@type': 'Store', name: 'ACME Biel', address }))
  .website(website({ '@type': 'WebSite', name: 'ACME', url: 'https://acme.example/' }))
  .breadcrumb(breadcrumb([{ name: 'Anvils', item: 'https://acme.example/anvils' }, { name: 'Executive Anvil' }]))
```

Each helper checks what Google Search needs of the node for a rich result,
read from Search Central — the page and its date are on each rule
(`ORGANIZATION`, `LOCAL_BUSINESS`, `WEBSITE`, `PROFILE_PAGE`, `BREADCRUMB`). A
missing required property throws a `RequirementError`
(`E_EPHEMERIS_MISSING_REQUIRED`, with `type`, `property` and `source`); a
missing recommended one is a warning, handed to `onWarning` or written once
with `console.warn` — `{ onWarning: () => {} }` silences it. `breadcrumb`
numbers the trail and wants two crumbs at least, each with its URL but the
last. `person` and `webPage` have no rich result of their own and are only
bounded.

Every helper bounds what it is given: no text over 10,000 characters
(`E_EPHEMERIS_TOO_LONG`), no more than 32 crumbs (`E_EPHEMERIS_TOO_MANY`), and
every URL (`url`, `sameAs`, `logo`, `image`, `item`…) absolute http(s) —
`javascript:` and `data:` are refused (`E_EPHEMERIS_INVALID_URL`).

### Content and commerce

`article`, `product` (a product reviewed or compared), `merchantListing` (a
product the page sells), `review`, `aggregateRating`, `event`, `jobPosting`,
`recipe`, `video`, `softwareApplication` and `course` check Google's rules for
each rich result, nested ones included — a product's offers (`Offer` or
`AggregateOffer`), reviews and rating; a merchant listing refuses an
`AggregateOffer`; a fully remote job needs the countries applicants may work
from.

Prices, currencies and dates are held to the form Google reads, refused
rather than converted: a price is a number or decimal digits with a `.` —
`"CHF 12"`, `"1,234.50"` or `-1` is `E_EPHEMERIS_INVALID_PRICE`; a currency is a
three-letter ISO 4217 code (`E_EPHEMERIS_INVALID_CURRENCY`); a date is ISO
8601 and real (`E_EPHEMERIS_INVALID_DATE`), and a date-time without a time
zone is a warning. A `Date` object is written in UTC, the same on every
machine.

Not covered: FAQ, which Google no longer shows (May 2026), and How-to; the
other types of Google's search gallery are not covered yet.

## The graph

```ts
import { jsonLdScriptTag, SchemaGraph } from '@c9up/ephemeris'

const graph = new SchemaGraph({ url: 'https://shop.example/anvils/executive' })
  .identity({ '@type': 'Organization', name: 'ACME' })   // https://shop.example/#identity
  .website({ '@type': 'WebSite', name: 'ACME shop' })    // https://shop.example/#website
  .webPage({ '@type': 'ItemPage', name: 'Executive Anvil' })
  .breadcrumb({ '@type': 'BreadcrumbList', itemListElement: [/* … */] })
  .mainEntity({ '@type': 'Product', name: 'Executive Anvil' })
  .add({ '@type': 'Person', '@id': '#author', name: 'Ada' })

jsonLdScriptTag(graph.toJsonLd(), { nonce })
```

Each root node has its slot and a stable `@id` — `#identity` and `#website`
on the site, `#webpage`, `#breadcrumb` and `#main-entity` on the page; any
other node keeps its own `@id` or gets `#/schema/<type>/<n>`. The website is
published by the identity, the page is part of the website and has the
breadcrumb and the main entity, which has the page — each link only when both
nodes are there, and never over a value the caller set.

A layout and a page may describe the same node: the declarations merge, the
types are united, and what the later one sets wins. Nothing is invented — no
default availability, no shortened headline — and empty values (`undefined`,
`null`, `""`, `[]`, `{}`) are dropped. Keys are ordered, so a page gives the
same bytes on every render. `__proto__`, `constructor` and `prototype` are
refused as keys (`E_EPHEMERIS_UNSAFE_KEY`), and the URLs must be absolute
http(s) (`E_EPHEMERIS_INVALID_URL`).

## The script tag

```ts
import { jsonLdScriptTag, toJsonLd } from '@c9up/ephemeris'

jsonLdScriptTag(product, { nonce: response.nonce })
// <script type="application/ld+json" nonce="…">{"@context":"https://schema.org",…}</script>

toJsonLd(product) // the plain object, for a client that updates the page itself
```

The text has no `<`, `>` or `&`: they are written `\u003c`, `\u003e` and
`\u0026`, which JSON reads back as the same characters, so data holding
`</script>` or `<!--` cannot end the tag — proved against Chromium's parser in
the tests. The nonce is the request's, passed in; the package never makes one
up. `undefined` is left out and a `Date` becomes an ISO string; a function, a
symbol, a `bigint`, `NaN`, a `Map`, a cycle or data nested 64 levels deep is
refused with an `EphemerisError` (`E_EPHEMERIS_INVALID_VALUE`,
`E_EPHEMERIS_CYCLE`, `E_EPHEMERIS_TOO_DEEP`) naming where it is.

## License

MIT, except the schema.org vocabulary and the types generated from it
(`src/schema.ts`), which are CC BY-SA 3.0 — see NOTICE.
