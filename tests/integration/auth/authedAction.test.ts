import { describe, expect, test, vi } from 'vitest';
import { authedAction, AuthenticationError, type ActionSession } from '../../../lib/auth/authedAction';

describe('authedAction', () => {
  test('blocks execution if no session', async () => {
    const businessLogic = vi.fn(async () => 'should not run');
    const getSession = vi.fn(async (): Promise<ActionSession | null> => null);

    const action = authedAction(businessLogic, getSession);

    await expect(action()).rejects.toThrow(AuthenticationError);
    expect(businessLogic).not.toHaveBeenCalled();
  });

  test('runs the wrapped action with the session when authenticated', async () => {
    const session: ActionSession = { user: { id: 'u1', email: 'a@b.com', name: 'A' } };
    const getSession = vi.fn(async (): Promise<ActionSession | null> => session);
    const businessLogic = vi.fn(async (s: ActionSession, x: number) => `${s.user.id}-${x}`);

    const action = authedAction(businessLogic, getSession);
    const result = await action(5);

    expect(result).toBe('u1-5');
    expect(businessLogic).toHaveBeenCalledWith(session, 5);
  });
});
