import { reminderDue } from '../../../app/actions/replies';

/** After 25 replies not saved to a file, Run says so and names the button that saves them (FR-059, SC-032). */
export function SaveReminder({ repliesSinceSave }: { repliesSinceSave: number }) {
  if (!reminderDue(repliesSinceSave)) return null;
  return (
    <p role="alert" class="save-reminder">
      {`${repliesSinceSave} replies are not saved to a file. Press Save evaluation now, so that a closed page does not lose them.`}
    </p>
  );
}
