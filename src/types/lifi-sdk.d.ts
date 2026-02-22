declare module "@lifi/sdk" {
  export type RouteOptions = Record<string, unknown>;
  export type Route = Record<string, unknown>;
  export type RoutesRequest = Record<string, unknown>;
  export type RoutesResponse = Record<string, unknown>;
  export type QuoteRequest = Record<string, unknown>;
  export type QuoteResponse = Record<string, unknown>;

  export function getRoutes(request: RoutesRequest, options?: RouteOptions): Promise<RoutesResponse>;
  export function getQuote(request: QuoteRequest, options?: RouteOptions): Promise<QuoteResponse>;
}
