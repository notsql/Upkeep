from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from ml.config import settings
from ml.model import OnnxModel

# No CORS: the browser never calls this service, only the Spring API does.


class PredictRequest(BaseModel):
    inputs: dict[str, Any] = Field(
        description="Model input name -> tensor, as nested lists."
    )


class PredictResponse(BaseModel):
    outputs: dict[str, Any]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast on a missing or broken model rather than on the first request.
    app.state.model = OnnxModel(settings.model_path)
    yield


app = FastAPI(
    title="ML Inference",
    description="Serves the project's ONNX model to the Spring API.",
    version="0.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/model")
def model(request: Request) -> dict[str, Any]:
    return request.app.state.model.describe()


@app.post("/predict")
def predict(request: Request, body: PredictRequest) -> PredictResponse:
    try:
        outputs = request.app.state.model.predict(body.inputs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PredictResponse(outputs=outputs)
