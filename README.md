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

## License

MIT
