import type { AuthenticatedUser } from './auth';
import type { AppApiEnv } from './env';

export type AppEnv = {
  Bindings: Env;
  Variables: {
    auth: AuthenticatedUser;
    env: AppApiEnv;
  };
};
