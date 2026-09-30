import { getErrorMessage } from './http';

// Passes on the result of a request, unless isCancelled turns true first (a newer request replaced it)
export async function whenLoaded<T>(
  request: Promise<T>,
  isCancelled: () => boolean,
  onValue: (value: T) => void,
  onError: (message: string) => void,
) {
  try {
    const value = await request;
    if (!isCancelled()) onValue(value);
  } catch (err) {
    if (!isCancelled()) onError(getErrorMessage(err));
  }
}
