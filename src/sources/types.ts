// The one interface through which judge replies reach an evaluation (Principle III, contracts/core-api.md).
import type { Problem } from '../core/model';

export interface ReplyItem {
  case_id: string;
  reply: string;
}

export interface ReplyBatch {
  items: ReplyItem[];
  /** Entries that could not be read, with the reason. */
  problems: Problem[];
}

export interface JudgeReplySource<Request> {
  id: string;
  label: string;
  collect(request: Request): Promise<ReplyBatch>;
}
