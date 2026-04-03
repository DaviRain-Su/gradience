// Stub: A2ARouter -- will be implemented when A2A routing is built

export interface A2ARouter {
  sendMessage(to: string, message: unknown): Promise<void>;
  onMessage(handler: (from: string, message: unknown) => void): void;
  subscribe(handler: (message: any) => void): void;
  send(message: unknown, to?: string): Promise<void>;
}
