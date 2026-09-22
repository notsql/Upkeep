import logging
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ml.config import settings
from ml.model import OnnxModel

logger = logging.getLogger(__name__)

# No CORS: the browser never calls this service, only the Spring API does.


class PredictRequest(BaseModel):
    inputs: dict[str, Any] = Field(
        description="Model input name -> tensor, as nested lists."
    )


class PredictResponse(BaseModel):
    outputs: dict[str, Any]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # A missing model is expected before one is trained: start anyway and
    # report it through /health. A broken model file still fails fast.
    if settings.model_path.is_file():
        app.state.model = OnnxModel(settings.model_path)
    else:
        logger.warning("No ONNX model at %s; serving without one", settings.model_path)
        app.state.model = None
    yield


app = FastAPI(
    title="ML Inference",
    description="Serves the project's ONNX model to the Spring API.",
    version="0.0.0",
    lifespan=lifespan,
)


def loaded_model(request: Request) -> OnnxModel:
    model = request.app.state.model
    if model is None:
        raise HTTPException(status_code=503, detail="No model is loaded")
    return model


LoadedModel = Annotated[OnnxModel, Depends(loaded_model)]


@app.get("/health", responses={503: {"description": "No model is loaded"}})
def health(request: Request) -> JSONResponse:
    if request.app.state.model is None:
        return JSONResponse({"status": "no_model"}, status_code=503)
    return JSONResponse({"status": "ok"})


@app.get("/model")
def model(loaded: LoadedModel) -> dict[str, Any]:
    return loaded.describe()


@app.post("/predict")
def predict(loaded: LoadedModel, body: PredictRequest) -> PredictResponse:
    try:
        outputs = loaded.predict(body.inputs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PredictResponse(outputs=outputs)
