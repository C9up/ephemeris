/**
 * Ephemeris errors.
 *
 * Structured data often carries what a request sent, so a refusal has to be
 * something a caller can branch on: a stable `E_EPHEMERIS_<REASON>` code, not
 * a message.
 */

export class EphemerisError extends Error {
	readonly code: `E_EPHEMERIS_${string}`;

	constructor(
		code: `E_EPHEMERIS_${string}`,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = new.target.name;
		this.code = code;
	}
}
