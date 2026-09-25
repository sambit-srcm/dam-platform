import { NonRetryableJobError } from '@dam/queue';

// The file itself is the problem, so retrying can never help.
// The reason is stored on the asset so the user can see why it failed.
export class UnprocessableMediaError extends NonRetryableJobError {
  name = 'UnprocessableMediaError';
  reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.reason = reason;
  }
}
