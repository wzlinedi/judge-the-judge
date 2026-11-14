// The only adapter of this version: one reply for one case, read from the clipboard or typed into the box (FR-056).
import type { JudgeReplySource } from './types';

export interface PastedReplyRequest {
  caseId: string;
  text: string;
}

export const pastedReplySource: JudgeReplySource<PastedReplyRequest> = {
  id: 'pasted-reply',
  label: 'Pasted reply',
  async collect({ caseId, text }) {
    if (text.trim() === '') {
      return { items: [], problems: [{ message: 'The reply is empty. Paste the judge’s reply first.' }] };
    }
    // Any other text is kept exactly as it came: reading it is the job of the rules, not of the source.
    return { items: [{ case_id: caseId, reply: text }], problems: [] };
  },
};
