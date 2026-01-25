import { createClient } from '../xrpc/client';

export const api = createClient({
  baseUrl: 'http://localhost:8080/api',
});
