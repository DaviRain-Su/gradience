// Main client
export { XMTPClient, createXMTPClient } from "./client";

// Codec
export {
  GradienceCodec,
  GRADIENCE_CONTENT_TYPE,
  GRADIENCE_CONTENT_TYPE_STR,
  buildSigningInput,
  buildUnsignedMessage,
} from "./codec";

// Types
export {
  GradienceMessageType,
} from "./types";
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
} from "./types";

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
} from "./utils";
