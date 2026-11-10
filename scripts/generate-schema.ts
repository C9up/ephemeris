/**
 * Writes `src/schema.ts` and `src/url-properties.ts` from the release file
 * kept in `vocabulary/`.
 *
 *   node scripts/generate-schema.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
	generateSchema,
	generateUrlProperties,
	VOCABULARY_FILE,
} from "./schema-generator.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const vocabulary: unknown = JSON.parse(
	readFileSync(`${root}${VOCABULARY_FILE}`, "utf8"),
);
writeFileSync(`${root}src/schema.ts`, generateSchema(vocabulary));
writeFileSync(
	`${root}src/url-properties.ts`,
	generateUrlProperties(vocabulary),
);
