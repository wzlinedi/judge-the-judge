// The size limits of what the tool reads and keeps (code review S4; data-model.md; Clarifications 2026-11-16).
// A limit keeps one huge file or reply from freezing the page; each refusal says the size and the limit.

/** A file of this size is read; a larger one is refused before its content is read. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** A saved judge reply, in characters. */
export const MAX_REPLY_LENGTH = 200_000;
/** The prompt stored with a reply, in characters. */
export const MAX_PROMPT_LENGTH = 1_000_000;

const grouped = (value: number): string => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "The file is 72 MB; the tool reads files up to 50 MB." The size is rounded up, so a file over the limit never reads "50 MB". */
export function fileTooLargeMessage(bytes: number): string {
  return `The file is ${Math.ceil(bytes / (1024 * 1024))} MB; the tool reads files up to ${MAX_FILE_BYTES / (1024 * 1024)} MB.`;
}

export const isFileTooLarge = (bytes: number | undefined): boolean => bytes !== undefined && bytes > MAX_FILE_BYTES;

export class FileTooLargeError extends Error {
  constructor(bytes: number) {
    super(fileTooLargeMessage(bytes));
    this.name = 'FileTooLargeError';
  }
}

/** "The reply is 200,001 characters; the tool keeps replies up to 200,000 characters." Null when the reply fits. */
export function replyTooLongMessage(length: number): string | null {
  if (length <= MAX_REPLY_LENGTH) return null;
  return `The reply is ${grouped(length)} characters; the tool keeps replies up to ${grouped(MAX_REPLY_LENGTH)} characters.`;
}

/** "The prompt for this case is 1,000,010 characters; the tool keeps prompts up to 1,000,000 characters." */
export function promptTooLongMessage(length: number): string {
  return `The prompt for this case is ${grouped(length)} characters; the tool keeps prompts up to ${grouped(MAX_PROMPT_LENGTH)} characters. Shorten the judge's prompt or the fields of the case.`;
}
