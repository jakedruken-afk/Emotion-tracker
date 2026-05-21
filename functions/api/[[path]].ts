type Env = {
  LAMB_BACKEND: Fetcher;
};

type PagesContext = {
  request: Request;
  env: Env;
};

export const onRequest = async ({ request, env }: PagesContext) => {
  return env.LAMB_BACKEND.fetch(request);
};
