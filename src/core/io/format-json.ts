// A pasted JSON is shown at once with new lines and an indent of 2 spaces (T292, FR-084).

/**
 * The text formatted when the whole of it is valid JSON; undefined otherwise. JSON in a code fence, or with other text around it,
 * is not valid as a whole, so it is never formatted and the line and column of a problem point at the user's text.
 */
export function formatWholeJson(text: string): string | undefined {
  if (text.trim() === '') return undefined;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return undefined;
  }
}

/** The text formatted when the whole of it is valid JSON; the same text otherwise. */
export function formatIfWholeJson(text: string): string {
  return formatWholeJson(text) ?? text;
}
