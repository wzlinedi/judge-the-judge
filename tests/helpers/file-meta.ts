// The details a save passes in (the core has no clock and hashing is asynchronous), fixed for the file tests.
import type { TestProjectMeta } from '../../src/core/io/test-project-file';

export const FILE_META: TestProjectMeta = { now: '2026-01-01T00:00:00Z', toolVersion: '1', judgeVersion: 'aaaaaaaaaaaa', testCasesVersion: 'bbbbbbbbbbbb' };
