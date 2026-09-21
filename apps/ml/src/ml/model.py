from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort

# ONNX tensor element types -> numpy dtypes, for the types a JSON request can
# realistically carry.
_DTYPES: dict[str, np.dtype] = {
    "tensor(float)": np.dtype(np.float32),
    "tensor(double)": np.dtype(np.float64),
    "tensor(float16)": np.dtype(np.float16),
    "tensor(int64)": np.dtype(np.int64),
    "tensor(int32)": np.dtype(np.int32),
    "tensor(int16)": np.dtype(np.int16),
    "tensor(int8)": np.dtype(np.int8),
    "tensor(uint8)": np.dtype(np.uint8),
    "tensor(bool)": np.dtype(np.bool_),
    "tensor(string)": np.dtype(np.str_),
}


class UnknownInputError(ValueError):
    pass


class MissingInputError(ValueError):
    pass


class UnsupportedTypeError(ValueError):
    pass


class OnnxModel:
    """A loaded ONNX session plus the metadata needed to validate requests."""

    def __init__(self, path: Path) -> None:
        if not path.is_file():
            raise FileNotFoundError(f"No ONNX model at {path}")
        self.path = path
        self.session = ort.InferenceSession(
            str(path), providers=["CPUExecutionProvider"]
        )
        self._inputs = {i.name: i for i in self.session.get_inputs()}
        self._outputs = [o.name for o in self.session.get_outputs()]

    def describe(self) -> dict[str, Any]:
        return {
            "path": str(self.path),
            "inputs": [
                {"name": i.name, "type": i.type, "shape": i.shape}
                for i in self.session.get_inputs()
            ],
            "outputs": [
                {"name": o.name, "type": o.type, "shape": o.shape}
                for o in self.session.get_outputs()
            ],
        }

    def predict(self, inputs: dict[str, Any]) -> dict[str, Any]:
        feeds = {name: self._as_array(name, value) for name, value in inputs.items()}

        missing = sorted(set(self._inputs) - set(feeds))
        if missing:
            raise MissingInputError(f"Missing model inputs: {', '.join(missing)}")

        results = self.session.run(self._outputs, feeds)
        return {
            name: value.tolist() if isinstance(value, np.ndarray) else value
            for name, value in zip(self._outputs, results, strict=True)
        }

    def _as_array(self, name: str, value: Any) -> np.ndarray:
        spec = self._inputs.get(name)
        if spec is None:
            known = ", ".join(sorted(self._inputs))
            raise UnknownInputError(f"Unknown model input '{name}'. Expected: {known}")

        dtype = _DTYPES.get(spec.type)
        if dtype is None:
            raise UnsupportedTypeError(
                f"Input '{name}' has unsupported type {spec.type}"
            )

        return np.asarray(value, dtype=dtype)
