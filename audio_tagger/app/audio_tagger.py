import os, subprocess, tempfile, logging
import numpy as np
import soundfile as sf
import librosa
from tensorflow.lite.python.interpreter import Interpreter

# ─── disable numba JIT & cache
os.environ.setdefault("NUMBA_DISABLE_JIT", "1")
os.environ.setdefault("NUMBA_CACHE_DIR", "/tmp")

log = logging.getLogger()
log.setLevel(logging.INFO)

WINDOW_SEC  = 3.0
HOP_SEC     = 0.5
SAMPLE_RATE = 48000
THRESHOLD   = 0.30

def _ffmpeg_convert(in_file: str) -> str:
    """Return a 48 kHz mono wav copy (tmp)."""
    tmp = tempfile.mktemp(suffix=".wav")
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-i", in_file, "-ac", "1", "-ar", str(SAMPLE_RATE), tmp]
    subprocess.check_call(cmd)
    return tmp

def _read_audio(path: str) -> np.ndarray:
    """Always returns mono float32 @ 48 kHz."""
    y, sr = sf.read(path, always_2d=True)
    y = y.mean(axis=1) if y.shape[1] > 1 else y[:, 0]
    if sr != SAMPLE_RATE:
        y = librosa.resample(y, orig_sr=sr, target_sr=SAMPLE_RATE)
    return y.astype(np.float32)

def _frame_audio(y: np.ndarray) -> np.ndarray:
    win  = int(WINDOW_SEC * SAMPLE_RATE)
    hop  = int(HOP_SEC    * SAMPLE_RATE)
    n_fr = 1 + max(0, len(y) - win) // hop
    return np.stack([y[i*hop : i*hop + win] for i in range(n_fr)])

def main(audio_path: str, model_path: str, label_path: str) -> dict:
    # labels
    with open(label_path, encoding="utf-8") as fh:
        labels = [l.strip() for l in fh]

    # .wav
    wav = _ffmpeg_convert(audio_path) if not audio_path.endswith(".wav") else audio_path
    y   = _read_audio(wav)
    if len(y) < int(WINDOW_SEC * SAMPLE_RATE):
        raise ValueError("Audio shorter than analysis window.")

    samples = _frame_audio(y)                       
    log.info("Frames: %d", len(samples))

    # TF-Lite inference
    itp = Interpreter(model_path=model_path, num_threads=4)
    itp.allocate_tensors()
    inp_i = itp.get_input_details()[0]["index"]
    out_i = itp.get_output_details()[0]["index"]

    itp.resize_tensor_input(inp_i, [len(samples), samples.shape[1]])
    itp.allocate_tensors()
    itp.set_tensor(inp_i, samples)
    itp.invoke()
    scores = itp.get_tensor(out_i)            

    # max over frames
    max_scores = scores.max(axis=0)
    idx = np.where(max_scores >= THRESHOLD)[0]
    species = {labels[i]: 1 for i in idx}

    log.info("Detected %d species: %s", len(species), list(species.keys())[:5])
    duration = len(y) / SAMPLE_RATE

    return species, duration