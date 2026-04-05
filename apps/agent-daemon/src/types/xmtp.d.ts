// Type declarations for @xmtp/xmtp-js
// This is a stub declaration file to resolve TypeScript errors
// XMTP is an optional peer dependency

declare module '@xmtp/xmtp-js' {
  export class Client {
    static create(
      privateKey: Uint8Array,
      options: { env: 'production' | 'dev' }
    ): Promise<Client>;
    address: string;
    // Add other methods as needed
  }
}
