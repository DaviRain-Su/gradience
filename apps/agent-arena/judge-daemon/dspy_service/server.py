#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

try:
    import dspy  # type: ignore
except Exception:  # pragma: no cover
    dspy = None  # type: ignore


@dataclass
class EvaluationResult:
    score: int
    reasoning: str
    dimension_scores: dict[str, float]
    confidence: float


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def clamp_confidence(value: float) -> float:
    return max(0.0, min(1.0, value))


class HeuristicEvaluator:
    def evaluate(self, payload: dict[str, Any]) -> EvaluationResult:
        result_text = str(payload.get("result", ""))
        trace_text = str(payload.get("trace", ""))
        criteria = payload.get("criteria")
        dimension_scores: dict[str, float] = {}
        if isinstance(criteria, dict) and isinstance(criteria.get("dimensions"), list):
            for item in criteria["dimensions"]:
                if isinstance(item, dict) and isinstance(item.get("name"), str):
                    dimension_scores[item["name"]] = 80.0

        base = 60 + min(30, len(result_text) // 50) + min(10, len(trace_text) // 200)
        score = clamp_score(base)
        confidence = 0.8 if result_text else 0.5
        return EvaluationResult(
            score=score,
            reasoning="heuristic evaluator fallback",
            dimension_scores=dimension_scores,
            confidence=confidence,
        )


class DspyEvaluator:
    def __init__(self) -> None:
        if dspy is None:  # pragma: no cover
            raise RuntimeError("dspy is not installed")

        model = os.getenv("DSPY_MODEL", "openai/gpt-4o-mini")
        api_key = os.getenv("DSPY_API_KEY") or os.getenv("OPENAI_API_KEY")
        try:
            lm = dspy.LM(model=model, api_key=api_key) if api_key else dspy.LM(model=model)
            dspy.configure(lm=lm)
        except Exception as error:  # pragma: no cover
            raise RuntimeError(f"failed to configure dspy: {error}") from error

        class EvaluationSignature(dspy.Signature):
            task_desc = dspy.InputField()
            criteria = dspy.InputField()
            result = dspy.InputField()
            trace = dspy.InputField()
            score = dspy.OutputField()
            reasoning = dspy.OutputField()
            dimension_scores = dspy.OutputField()
            confidence = dspy.OutputField()

        class LLMScoreEvaluator(dspy.Module):
            def __init__(self) -> None:
                super().__init__()
                self.judge = dspy.ChainOfThought(EvaluationSignature)

            def forward(self, task_desc: str, criteria: str, result: str, trace: str):
                return self.judge(
                    task_desc=task_desc,
                    criteria=criteria,
                    result=result,
                    trace=trace,
                )

        self.evaluator = LLMScoreEvaluator()

    def evaluate(self, payload: dict[str, Any]) -> EvaluationResult:
        prediction = self.evaluator(
            task_desc=str(payload.get("task_desc", "")),
            criteria=json.dumps(payload.get("criteria", {}), ensure_ascii=False),
            result=str(payload.get("result", "")),
            trace=str(payload.get("trace", "")),
        )
        score = clamp_score(float(getattr(prediction, "score", 0)))
        confidence = clamp_confidence(float(getattr(prediction, "confidence", 0)))
        reasoning = str(getattr(prediction, "reasoning", ""))
        raw_dimensions = getattr(prediction, "dimension_scores", {})
        if isinstance(raw_dimensions, str):
            try:
                raw_dimensions = json.loads(raw_dimensions)
            except json.JSONDecodeError:
                raw_dimensions = {}
        if not isinstance(raw_dimensions, dict):
            raw_dimensions = {}
        dimension_scores = {
            str(key): float(value)
            for key, value in raw_dimensions.items()
            if isinstance(value, (int, float))
        }
        return EvaluationResult(
            score=score,
            reasoning=reasoning or "dspy evaluation",
            dimension_scores=dimension_scores,
            confidence=confidence,
        )


def create_evaluator():
    if dspy is None:
        return HeuristicEvaluator()
    try:
        return DspyEvaluator()
    except Exception:
        return HeuristicEvaluator()


EVALUATOR = create_evaluator()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if self.path != "/evaluate":
            self._send_json(404, {"error": "not_found"})
            return
        length = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json(400, {"error": "invalid_json"})
            return
        if not isinstance(payload, dict):
            self._send_json(400, {"error": "invalid_payload"})
            return
        try:
            result = EVALUATOR.evaluate(payload)
        except Exception as error:
            self._send_json(500, {"error": str(error)})
            return
        self._send_json(
            200,
            {
                "score": result.score,
                "reasoning": result.reasoning,
                "dimension_scores": result.dimension_scores,
                "confidence": result.confidence,
            },
        )

    def do_GET(self) -> None:
        if self.path == "/healthz":
            self._send_json(200, {"ok": True})
            return
        self._send_json(404, {"error": "not_found"})

    def log_message(self, format: str, *args: Any) -> None:
        if os.getenv("DSPY_SERVICE_LOG", "0") not in ("1", "true", "TRUE"):
            return
        super().log_message(format, *args)

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    port = int(os.getenv("DSPY_SERVICE_PORT", "8788"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"dspy_service listening on :{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
