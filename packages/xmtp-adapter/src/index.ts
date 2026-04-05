// Main client
export { XMTPClient, createXMTPClient } from "./client.js";

// XMTP Adapter
export { XMTPAdapter } from "./xmtp-adapter.js";
export type { XMTPAdapterOptions } from "./xmtp-adapter.js";

// Codec
export {
  GradienceCodec,
  GRADIENCE_CONTENT_TYPE,
  GRADIENCE_CONTENT_TYPE_STR,
  buildSigningInput,
  buildUnsignedMessage,
} from "./codec.js";

// Types
export {
  GradienceMessageType,
} from "./types.js";
export type {
  A2AMessage,
  A2APayload,
  TaskOfferPayload,
  TaskResultPayload,
  JudgeVerdictPayload,
  PaymentConfirmationPayload,
  ConversationMeta,
  MessagingAdapter,
  WalletSigner,
  MessageCallback,
  AdapterConfig,
} from "./types.js";

// Utils
export {
  generateMessageId,
  canonicalize,
  bigintReplacer,
  bigintReviver,
  isValidEthAddress,
  normalizeAddress,
  withRetry,
  isTaskOffer,
  isTaskResult,
  isJudgeVerdict,
  isPaymentConfirmation,
} from "./utils.js";
