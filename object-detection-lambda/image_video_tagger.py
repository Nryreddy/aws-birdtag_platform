import os, json, argparse
import cv2
from ultralytics import YOLO
from collections import defaultdict, Counter
import supervision as sv


# ─────────────────────────  CONFIG  ──────────────────────────
MODEL_PATH = os.getenv("YOLO_WEIGHTS", "./model.pt")  
CONF_THR   = float(os.getenv("CONF_THR", 0.7))
OUT_DIR = os.getenv("OUT_DIR", "/tmp") 
os.makedirs(OUT_DIR, exist_ok=True)


# ────────────────────────  MODEL CACHE  ──────────────────────
_model = None
def get_model():
    """Load YOLOv8 model once (CPU)."""
    global _model
    if _model is None:
        print(f"[init] loading model ⇒ {MODEL_PATH}")
        _model = YOLO(MODEL_PATH).to("cpu")
        _model.fuse()
    return _model

# ─────────────────────────  HELPERS  ─────────────────────────
def dump_json(path, payload):
    with open(path, "w") as fh:
        json.dump(payload, fh, indent=2)

def draw_boxes(frame, boxes, scores, names):
    for (x1, y1, x2, y2), sc, nm in zip(boxes, scores, names):
        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)),
                      (0, 255, 0), 2)
        cv2.putText(frame, f"{nm} {sc*100:.1f}%",
                    (int(x1), int(max(0, y1)-6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)

# ───────────────────────  IMAGE  MODE  ───────────────────────
def tag_image(path, conf_thr=CONF_THR):
    img = cv2.imread(path)
    if img is None:
        raise RuntimeError(f"Cannot read {path}")

    res      = get_model()(img, verbose=False)[0]
    conf_arr = res.boxes.conf.cpu().numpy()
    keep     = conf_arr > conf_thr
    boxes    = res.boxes.xyxy.cpu().numpy()[keep]
    scores   = conf_arr[keep]
    classes  = res.boxes.cls.cpu().numpy()[keep]
    names    = [get_model().names[int(c)] for c in classes]

    draw_boxes(img, boxes, scores, names)

    base = os.path.basename(path)
    stem, ext = os.path.splitext(base) 
    out_path = os.path.join(OUT_DIR, f"{stem}_annotated{ext}")

    # Set default JPEG quality or use PNG compression
    if ext.lower() in [".jpg", ".jpeg"]:
        cv2.imwrite(out_path, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    elif ext.lower() == ".png":
        cv2.imwrite(out_path, img, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    else:
        cv2.imwrite(out_path, img)

    # count boxes per species
    counts = dict(Counter(names))
    print(f"Detected {sum(counts.values())} boxes: {counts}")

    detected = sum(counts.values()) > 0

    meta = {
        "detected" : detected,
        "file"     : base,
        "file_type": ext[1:],
        "type"     : "image",
        "tags"     : counts        
    }

    dump_json(out_path + ".json", meta)
    print(f"Image done → {out_path}")


def _fourcc_for(ext: str) -> str:
    """Return FOURCC for common containers."""
    return {"avi": "XVID", "mov": "mp4v", "mp4": "mp4v"}.get(ext.lstrip("."), "mp4v")


# ───────────────────────  VIDEO  MODE  ───────────────────────
def tag_video(path, conf_thr=0.7, out_fps=24, lock_after=10):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {path}")

    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    base, stem = os.path.basename(path), os.path.splitext(os.path.basename(path))[0]
    out_ext = os.path.splitext(path)[1].lower()       # keep .mp4 / .avi / .mov
    out_mp  = os.path.join(OUT_DIR, f"{stem}_annotated{out_ext}")
    vw = cv2.VideoWriter(
        out_mp,
        cv2.VideoWriter_fourcc(*_fourcc_for(out_ext)),
        out_fps,
        (W, H),
    )

    model   = get_model()
    tracker = sv.ByteTrack(frame_rate=out_fps)
    box_annot  = sv.BoxAnnotator(color_lookup=sv.ColorLookup.TRACK)
    label_annot = sv.LabelAnnotator(text_thickness=2, text_position=sv.Position.TOP_LEFT)

    # tracking & label-locking
    accum: dict[int, Counter] = defaultdict(Counter)
    locked: dict[int, str]    = {}

    # keep max-simultaneous counts per species
    max_frame_counts: Counter = Counter()

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        res   = model(frame, verbose=False)[0]
        confs = res.boxes.conf.cpu().numpy()
        keep  = confs > conf_thr
        dets  = sv.Detections.from_ultralytics(res)[keep]
        dets  = tracker.update_with_detections(detections=dets)

        final_labels = []
        for tid, cls_idx, conf in zip(dets.tracker_id, dets.class_id, dets.confidence):
            sp = model.names[int(cls_idx)]
            if tid not in locked:
                accum[tid][sp] += float(conf)
                if sum(accum[tid].values()) >= lock_after:
                    locked[tid] = max(accum[tid], key=accum[tid].get)
            final_labels.append(locked.get(tid, sp))

        # --------- update per-frame max counts -------------
        frame_counts = Counter(final_labels)
        for k, v in frame_counts.items():
            if v > max_frame_counts[k]:
                max_frame_counts[k] = v

        # -------------- annotate & write -------------------
        box_annot.annotate(frame, detections=dets)
        label_annot.annotate(frame, detections=dets, labels=final_labels)
        vw.write(frame)

    cap.release()
    vw.release()

    print(f"Detected {sum(max_frame_counts.values())} boxes: {max_frame_counts}")

    if sum(max_frame_counts.values()) == 0:
        detected = False
    else:
        detected = True

    meta = {
        "detected" : detected,
        "file"     : base,
        "file_type": os.path.splitext(base)[1][1:],
        "type"     : "video",
        "tags"     : dict(max_frame_counts)  # highest simultaneous count
    }
    dump_json(out_mp + ".json", meta)
    print(f"Video done → {out_mp}")

