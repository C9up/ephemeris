import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jsonLdScriptTag } from "../../src/index.js";

/**
 * The tag parsed by a real HTML parser: Chromium's. Each payload tries to
 * end the script or to throw the parser into a state where the real end tag
 * is missed, and then to run code that records it ran.
 */

const PAYLOADS: Record<string, string> = {
	closing: "</script><script>window.ran.push('closing')</script>",
	upperCase: "</SCRIPT ><script>window.ran.push('upperCase')</script>",
	commentOpen: "<!--<script>",
	commentThenClose:
		"<!--<script></script><script>window.ran.push('commentThenClose')</script>",
	cdata: "]]></script><script>window.ran.push('cdata')</script>",
	attribute: "<img src=x onerror=\"window.ran.push('attribute')\">",
	separators: "line para end",
};

const data = {
	"@context": "https://schema.org",
	"@type": "Product",
	name: PAYLOADS.closing,
	description: PAYLOADS.upperCase,
	review: Object.entries(PAYLOADS).map(([name, body]) => ({
		"@type": "Review",
		name,
		reviewBody: body,
	})),
};

function page(head: string): string {
	return `<!doctype html><html><head><script>window.ran = []</script>${head}</head><body><p id="after">after</p></body></html>`;
}

let browser: Browser;

beforeAll(async () => {
	browser = await chromium.launch();
});

afterAll(async () => {
	await browser?.close();
});

describe("ephemeris > jsonLdScriptTag in Chromium", () => {
	it("cannot be broken out of, and reads back intact", async () => {
		const tab = await browser.newPage();
		await tab.setContent(page(jsonLdScriptTag(data, { nonce: "r4nd0m" })));
		const result = await tab.evaluate(() => {
			const scripts = document.querySelectorAll(
				'script[type="application/ld+json"]',
			);
			return {
				ran: Reflect.get(window, "ran"),
				count: scripts.length,
				nonce: scripts[0]?.getAttribute("nonce"),
				json: scripts[0]?.textContent ?? "",
				after: document.getElementById("after")?.textContent,
			};
		});
		expect(result.ran).toEqual([]);
		expect(result.count).toBe(1);
		expect(result.nonce).toBe("r4nd0m");
		expect(JSON.parse(result.json)).toEqual(data);
		expect(result.after).toBe("after");
		await tab.close();
	});

	it("is a test that sees a break-out: the naive tag does run the payloads", async () => {
		const tab = await browser.newPage();
		const naive = `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
		await tab.setContent(page(naive));
		const ran = await tab.evaluate(() => Reflect.get(window, "ran"));
		expect(ran).toContain("closing");
		await tab.close();
	});
});
