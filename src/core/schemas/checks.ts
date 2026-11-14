// The check configuration file (metric-and-checks.md, section 2).
export const CHECKS_FORMAT = 'judge-the-judge-checks';
export const CHECKS_SCHEMA_VERSION = 1;
// `minimum_sample` is a known key that is read and ignored, so it is not reported as unknown.
export const CHECKS_KEYS = ['format', 'schema_version', 'rules', 'minimum_sample'] as const;
