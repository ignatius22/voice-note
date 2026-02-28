import { eventContracts, type EventName, type EventPayload } from './contracts';
import { scrub } from './scrub';

export async function trackEvent<T extends EventName>(
  name: T,
  payload: EventPayload<T>,
): Promise<{ name: T; payload: Record<string, unknown> }> {
  const parsed = eventContracts[name].parse(payload);
  return {
    name,
    payload: scrub(parsed) as Record<string, unknown>,
  };
}
