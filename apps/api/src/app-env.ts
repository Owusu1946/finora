import type { ApiEnv } from '@finora/env/api';

import type { AuthenticatedUser } from './auth';

export type AppEnv = {
  Bindings: Env;
  Variables: {
    auth: AuthenticatedUser;
    env: ApiEnv;
  };
};
