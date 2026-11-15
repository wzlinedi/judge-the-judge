import { useEffect, useState } from 'preact/hooks';
import { testCasesVersion } from '../../../core/cases/version';
import { judgeVersion } from '../../../core/judge/version';
import type { TestProject } from '../../../core/model';

/** The judge version and the test cases version, computed as the work changes (they are hashes, so they are asynchronous). */
export function useVersions(evaluation: TestProject): { judge: string; cases: string } {
  const [versions, setVersions] = useState({ judge: '', cases: '' });
  const { judge_set, dataset } = evaluation;
  useEffect(() => {
    let current = true;
    void Promise.all([judgeVersion(judge_set), testCasesVersion(dataset.cases)]).then(([judge, cases]) => current && setVersions({ judge, cases }));
    return () => {
      current = false;
    };
  }, [judge_set, dataset.cases]);
  return versions;
}
