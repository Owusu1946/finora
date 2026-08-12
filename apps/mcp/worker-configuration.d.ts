interface Env {
  ENVIRONMENT: string;
  FINORA_API_URL: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  MCP_OBJECT: DurableObjectNamespace;
}
