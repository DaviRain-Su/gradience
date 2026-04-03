import {
  bigintReplacer,
  bigintReviver,
  canonicalize,
  generateMessageId,
  isValidEthAddress,
  normalizeAddress,
  withRetry,
  isTaskOffer,
  isTaskResult,
  isJudgeVerdict,
  isPaymentConfirmation,
} from "../utils";
import { GradienceMessageType, A2AMessage, TaskOfferPayload } from "../types";

describe("bigintReplacer / bigintReviver", () => {
  it("serialises bigint to '<n>n' string and back", () => {
    const obj = { amount: BigInt("9007199254740993") }; // > MAX_SAFE_INTEGER
    const json = JSON.stringify(obj, bigintReplacer);
    expect(json).toBe('{"amount":"9007199254740993n"}');
    const parsed = JSON.parse(json, bigintReviver);
    expect(parsed.amount).toBe(BigInt("9007199254740993"));
  });

  it("leaves non-bigint values unchanged", () => {
    const result = bigintReplacer("k", "hello");
    expect(result).toBe("hello");
    const result2 = bigintReviver("k", 42);
    expect(result2).toBe(42);
  });
});

describe("canonicalize", () => {
  it("sorts object keys alphabetically", () => {
    const out = canonicalize({ z: 1, a: 2, m: 3 });
    expect(out).toBe('{"a":2,"m":3,"z":1}');
  });

  it("produces the same string regardless of insertion order", () => {
    const a = canonicalize({ foo: 1, bar: 2 });
    const b = canonicalize({ bar: 2, foo: 1 });
    expect(a).toBe(b);
  });

  it("handles nested objects and arrays", () => {
    const out = canonicalize({ b: [3, 1, 2], a: { y: 10, x: 5 } });
    expect(out).toBe('{"a":{"x":5,"y":10},"b":[3,1,2]}');
  });
});

describe("generateMessageId", () => {
  it("includes sender prefix, timestamp, and sequence", () => {
    const id = generateMessageId("0xABCDEF1234567890", 1700000000000, 7);
    expect(id).toBe("0xabcdef-1700000000000-7");
  });
});

describe("isValidEthAddress", () => {
  it("accepts valid addresses", () => {
    expect(isValidEthAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
    expect(isValidEthAddress("0xAaBbCcDdEeFf0011223344556677889900aAbBcC")).toBe(true);
  });

  it("rejects invalid addresses", () => {
    expect(isValidEthAddress("not-an-address")).toBe(false);
    expect(isValidEthAddress("0xshort")).toBe(false);
    expect(isValidEthAddress("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });
});

describe("normalizeAddress", () => {
  it("lowercases the address", () => {
    expect(normalizeAddress("0xABCD")).toBe("0xabcd");
  });
});

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = jest.fn().mockResolvedValue(42);
    expect(await withRetry(fn)).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    let calls = 0;
    const fn = jest.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error("fail");
      return "ok";
    });
    const result = await withRetry(fn, 3, 0);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("always fail"));
    await expect(withRetry(fn, 2, 0)).rejects.toThrow("always fail");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("type narrowing helpers", () => {
  const base = {
    id: "x",
    sender: "0x1",
    recipient: "0x2",
    payload: {} as TaskOfferPayload,
    timestamp: 0,
    signature: "",
  };

  it("isTaskOffer", () => {
    const msg: A2AMessage = { ...base, messageType: GradienceMessageType.TaskOffer };
    expect(isTaskOffer(msg)).toBe(true);
    expect(isTaskResult(msg)).toBe(false);
  });

  it("isTaskResult", () => {
    const msg: A2AMessage = { ...base, messageType: GradienceMessageType.TaskResult };
    expect(isTaskResult(msg)).toBe(true);
    expect(isTaskOffer(msg)).toBe(false);
  });

  it("isJudgeVerdict", () => {
    const msg: A2AMessage = { ...base, messageType: GradienceMessageType.JudgeVerdict };
    expect(isJudgeVerdict(msg)).toBe(true);
  });

  it("isPaymentConfirmation", () => {
    const msg: A2AMessage = { ...base, messageType: GradienceMessageType.PaymentConfirmation };
    expect(isPaymentConfirmation(msg)).toBe(true);
  });
});
