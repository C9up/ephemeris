import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			include: ["src/**", "scripts/schema-generator.ts"],
			exclude: ["src/**/*.d.ts"],
			reporter: ["text-summary", "json-summary"],
			thresholds: {
				lines: 95,
				statements: 95,
				branches: 95,
				functions: 95,
			},
		},
	},
});
