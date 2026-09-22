from pathlib import Path

import numpy as np
import onnx
import pytest
from fastapi.testclient import TestClient
from onnx import TensorProto, helper

from ml.model import OnnxModel


@pytest.fixture(scope="module")
def model_path(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A one-node ONNX model that doubles a 1xN float tensor."""
    scale = helper.make_tensor("scale", TensorProto.FLOAT, [1], [2.0])
    node = helper.make_node("Mul", ["x", "scale"], ["y"])
    graph = helper.make_graph(
        [node],
        "double",
        [helper.make_tensor_value_info("x", TensorProto.FLOAT, [1, None])],
        [helper.make_tensor_value_info("y", TensorProto.FLOAT, [1, None])],
        initializer=[scale],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 18)])
    # onnx defaults to a newer IR version than the installed onnxruntime reads.
    model.ir_version = 10
    onnx.checker.check_model(model)

    path = tmp_path_factory.mktemp("models") / "model.onnx"
    onnx.save(model, path)
    return path


@pytest.fixture
def client(model_path: Path) -> TestClient:
    from ml.main import app

    app.state.model = OnnxModel(model_path)
    return TestClient(app)


def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_model_describes_its_signature(client: TestClient) -> None:
    body = client.get("/model").json()
    assert [i["name"] for i in body["inputs"]] == ["x"]
    assert [o["name"] for o in body["outputs"]] == ["y"]


def test_predict_runs_the_model(client: TestClient) -> None:
    response = client.post("/predict", json={"inputs": {"x": [[1.0, 2.0, 3.0]]}})

    assert response.status_code == 200
    assert np.allclose(response.json()["outputs"]["y"], [[2.0, 4.0, 6.0]])


def test_predict_rejects_an_unknown_input(client: TestClient) -> None:
    response = client.post("/predict", json={"inputs": {"nope": [[1.0]]}})

    assert response.status_code == 400
    assert "nope" in response.json()["detail"]


def test_predict_rejects_a_missing_input(client: TestClient) -> None:
    response = client.post("/predict", json={"inputs": {}})

    assert response.status_code == 400
    assert "x" in response.json()["detail"]


@pytest.fixture
def client_without_model() -> TestClient:
    from ml.main import app

    app.state.model = None
    return TestClient(app)


def test_health_reports_a_missing_model(client_without_model: TestClient) -> None:
    response = client_without_model.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "no_model"}


@pytest.mark.parametrize(
    ("method", "path"), [("GET", "/model"), ("POST", "/predict")]
)
def test_model_routes_503_without_a_model(
    client_without_model: TestClient, method: str, path: str
) -> None:
    response = client_without_model.request(method, path, json={"inputs": {}})

    assert response.status_code == 503
    assert "model" in response.json()["detail"].lower()


def test_starts_without_a_model_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from ml.config import settings
    from ml.main import app

    monkeypatch.setattr(settings, "model_path", tmp_path / "missing.onnx")
    with TestClient(app) as client:
        assert client.get("/health").status_code == 503
