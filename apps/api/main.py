import json
import os
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

DEFAULT_DB_PATH = os.path.join(os.getcwd(), "data", "strategies.sqlite")
DB_PATH = os.getenv("STRATEGY_DB_PATH", DEFAULT_DB_PATH)
TEMPLATES_PATH = os.getenv(
    "FASTAPI_TEMPLATES_PATH", os.path.join(os.path.dirname(__file__), "templates.json")
)
NODE_API_URL = os.getenv("NODE_API_URL", "http://127.0.0.1:4173").rstrip("/")

API_VERSION = os.getenv("FASTAPI_VERSION", "0.1.0")
API_STARTED_AT = datetime.utcnow().isoformat() + "Z"
API_INSTANCE_ID = os.getenv("FASTAPI_INSTANCE_ID", os.urandom(4).hex())
API_BUILD_COMMIT = os.getenv("FASTAPI_BUILD_COMMIT", "")
app = FastAPI(title="Monad Strategy API", version=API_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DASHBOARD_STATIC_PATH = os.getenv(
    "DASHBOARD_STATIC_PATH",
    os.path.join(os.path.dirname(__file__), "..", "dashboard", "public"),
)

if os.path.exists(DASHBOARD_STATIC_PATH):
    app.mount(
        "/", StaticFiles(directory=DASHBOARD_STATIC_PATH, html=True), name="dashboard"
    )


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _load_json(value):
    if value is None:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _proxy_post(path: str, payload: dict):
    url = f"{NODE_API_URL}{path}"
    data = json.dumps(payload or {}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(body)
        except json.JSONDecodeError:
            return exc.code, {"status": "error", "detail": body}
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Node API unreachable: {exc}")


def _proxy_get(path: str, params: dict | None = None):
    query = urllib.parse.urlencode(params or {}, doseq=True)
    suffix = f"?{query}" if query else ""
    url = f"{NODE_API_URL}{path}{suffix}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(body)
        except json.JSONDecodeError:
            return exc.code, {"status": "error", "detail": body}
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Node API unreachable: {exc}")


def _proxy_get_text(path: str, params: dict | None = None):
    query = urllib.parse.urlencode(params or {}, doseq=True)
    suffix = f"?{query}" if query else ""
    url = f"{NODE_API_URL}{path}{suffix}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return response.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        return exc.code, body
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Node API unreachable: {exc}")


@app.get("/health")
async def health():
    uptime_sec = round(
        time.time()
        - datetime.fromisoformat(API_STARTED_AT.replace("Z", "")).timestamp(),
        2,
    )
    errors = []
    if not os.path.exists(DB_PATH):
        errors.append("db_missing")
    if not os.path.exists(TEMPLATES_PATH):
        errors.append("templates_missing")
    return {
        "status": "ok",
        "dbPath": DB_PATH,
        "dbExists": os.path.exists(DB_PATH),
        "templatesPath": TEMPLATES_PATH,
        "templatesExists": os.path.exists(TEMPLATES_PATH),
        "nodeApiUrl": NODE_API_URL,
        "version": API_VERSION,
        "startedAt": API_STARTED_AT,
        "uptimeSec": uptime_sec,
        "instanceId": API_INSTANCE_ID,
        "buildCommit": API_BUILD_COMMIT,
        "errors": errors,
    }


@app.get("/health/node")
async def health_node():
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(f"{NODE_API_URL}/api/templates") as response:
            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            return {
                "status": "ok",
                "nodeStatus": response.status,
                "latencyMs": latency_ms,
            }
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Node API unreachable: {exc}")


@app.get("/api/templates")
async def list_templates():
    if not os.path.exists(TEMPLATES_PATH):
        return {"status": "ok", "templates": [], "note": "templates.json not found"}
    with open(TEMPLATES_PATH, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    return {"status": "ok", "templates": data}


@app.get("/api/defi/pools")
async def defi_pools(request: Request):
    params = dict(request.query_params)
    status, body = _proxy_get("/api/defi/pools", params)
    return JSONResponse(status_code=status, content=body)


@app.get("/api/defi/pools/{pool_id}")
async def defi_pool_detail(pool_id: str, request: Request):
    params = dict(request.query_params)
    status, body = _proxy_get(f"/api/defi/pools/{pool_id}", params)
    return JSONResponse(status_code=status, content=body)


@app.get("/api/defi/metrics")
async def defi_metrics(request: Request):
    params = dict(request.query_params)
    status, body = _proxy_get_text("/api/defi/metrics", params)
    return PlainTextResponse(status_code=status, content=body)


@app.get("/api/strategies")
async def list_strategies():
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, template, spec_json, status, created_at, updated_at FROM strategies ORDER BY created_at DESC"
        ).fetchall()
    strategies = [
        {
            "id": row["id"],
            "template": row["template"],
            "spec": _load_json(row["spec_json"]),
            "status": row["status"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]
    return {"status": "ok", "strategies": strategies}


@app.post("/api/strategies")
async def create_strategy(request: Request):
    payload = await request.json()
    status, body = _proxy_post("/api/strategies", payload)
    return JSONResponse(status_code=status, content=body)


@app.get("/api/strategies/{strategy_id}")
async def get_strategy(strategy_id: str):
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, template, spec_json, status, created_at, updated_at FROM strategies WHERE id = ?",
            (strategy_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not_found")
    return {
        "status": "ok",
        "strategy": {
            "id": row["id"],
            "template": row["template"],
            "spec": _load_json(row["spec_json"]),
            "status": row["status"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        },
    }


@app.get("/api/executions")
async def list_executions():
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, strategy_id, mode, status, payload_json, evidence_json, created_at "
            "FROM executions ORDER BY created_at DESC"
        ).fetchall()
    executions = [
        {
            "id": row["id"],
            "strategyId": row["strategy_id"],
            "mode": row["mode"],
            "status": row["status"],
            "payload": _load_json(row["payload_json"]),
            "evidence": _load_json(row["evidence_json"]) or {},
            "createdAt": row["created_at"],
        }
        for row in rows
    ]
    return {"status": "ok", "executions": executions}


@app.get("/api/executions/{execution_id}")
async def get_execution(execution_id: str):
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, strategy_id, mode, status, payload_json, evidence_json, created_at "
            "FROM executions WHERE id = ?",
            (execution_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not_found")
    return {
        "status": "ok",
        "execution": {
            "id": row["id"],
            "strategyId": row["strategy_id"],
            "mode": row["mode"],
            "status": row["status"],
            "payload": _load_json(row["payload_json"]),
            "evidence": _load_json(row["evidence_json"]) or {},
            "createdAt": row["created_at"],
        },
    }


@app.post("/api/strategies/{strategy_id}/run")
async def run_strategy(strategy_id: str, request: Request):
    payload = await request.json()
    status, body = _proxy_post(f"/api/strategies/{strategy_id}/run", payload)
    return JSONResponse(status_code=status, content=body)
