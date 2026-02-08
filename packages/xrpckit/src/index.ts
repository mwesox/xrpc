export {
  createRouter,
  group,
  createEndpoint,
  GROUP_NAME,
  getRouterMiddleware,
  type RouterDefinition,
  type EndpointGroup,
  type EndpointEntry,
  type RouterEntry,
  type Middleware,
  type RouterConfig,
} from "./router";
export { query, mutation, type EndpointDefinition } from "./endpoint";
export type { InferInput, InferOutput } from "./types";
