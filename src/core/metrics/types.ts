// Metric definitions are data only (metric-and-checks.md): no code, only known operations.
import type { Category, ErrorRule, ReplyMapping, TestCase } from '../model';

export interface MeasureDefinition {
  id: string;
  name: string;
  description: string;
  operation: 'ratio' | 'complement';
  numerator?: string;
  denominator?: string;
  of?: string;
  interval?: 'wilson95';
  better: 'higher' | 'lower';
}

export interface MetricParameterDefinition {
  default: number;
  description: string;
}

export interface MetricDefinition {
  format: 'judge-the-judge-metric';
  schema_version: number;
  id: string;
  name: string;
  description: string;
  limitations: string;
  output_format: string;
  judge_set: {
    prompt: string;
    judged_text?: string;
    sample_reply?: string;
    reply_mapping: ReplyMapping;
    error_rules: ErrorRule[];
    error_catalog: Category[];
    clean_base_cases: Array<Pick<TestCase, 'name' | 'fields' | 'expected_errors'>>;
  };
  parameters: Record<string, MetricParameterDefinition>;
  measures: MeasureDefinition[];
}

/** What a test project or an evaluation file may carry of a metric, so that one file holds everything (T243): no id (the reference names it), no starter judge. */
export type MetricDetails = Pick<MetricDefinition, 'name' | 'description' | 'limitations' | 'output_format' | 'parameters' | 'measures'>;

export interface MeasureValue {
  id: string;
  name: string;
  /** null means "not available". */
  value: number | null;
  numerator?: number;
  denominator?: number;
  interval: { lower: number; upper: number } | null;
  better: 'higher' | 'lower';
}

export interface CheckOutcome {
  measure: string;
  comparison: 'at_least' | 'at_most';
  threshold: number;
  value: number | null;
  passed: boolean;
}
