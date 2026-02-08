export { type EndpointDefinition, mutation, query } from "./endpoint";
export {
  createEndpoint,
  createRouter,
  type EndpointEntry,
  type EndpointGroup,
  GROUP_NAME,
  getRouterMiddleware,
  group,
  type Middleware,
  type RouterConfig,
  type RouterDefinition,
  type RouterEntry,
} from "./router";
export type { InferInput, InferOutput } from "./types";
