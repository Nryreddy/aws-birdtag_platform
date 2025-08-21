import os, tempfile, json, boto3, importlib
from datetime import datetime, timezone
from decimal import Decimal
import cv2

# ─── Environment ───────────────────────────────────────────────────────────────
ANNOT_BUCKET   = os.environ["ANNOT_BUCKET"]
TABLE_NAME     = os.environ["TABLE_NAME"]

MODEL_BUCKET   = os.getenv("MODEL_BUCKET")            
MODEL_PREFIX   = os.getenv("MODEL_PREFIX", "birdtag-ImageVideo-model/")
REGION         = os.getenv("AWS_REGION", "us-east-1")

ANNOT_PREFIX = "annotated/"

s3    = boto3.client("s3")
table = boto3.resource("dynamodb").Table(TABLE_NAME)

# ─── Helper: download *latest* .pt under MODEL_PREFIX ──────────────────────────
def _download_latest_model(tmpdir: str) -> str:
    """
    Pick the most-recent *.pt* file in MODEL_BUCKET/MODEL_PREFIX,
    download to `tmpdir`, return its local path.
    """
    resp  = s3.list_objects_v2(Bucket=MODEL_BUCKET, Prefix=MODEL_PREFIX)
    pats  = [o for o in resp.get("Contents", []) if o["Key"].lower().endswith(".pt")]
    if not pats:
        raise RuntimeError("No .pt model in S3 folder")

    newest = max(pats, key=lambda o: o["LastModified"])
    local  = os.path.join(tmpdir, os.path.basename(newest["Key"]))
    s3.download_file(MODEL_BUCKET, newest["Key"], local)

    print(f"[INFO] Using model: s3://{MODEL_BUCKET}/{newest['Key']}")
    return local

# ─── Lambda entry ──────────────────────────────────────────────────────────────
def lambda_handler(event, _ctx):
    rec      = event["Records"][0]
    src_bkt  = rec["s3"]["bucket"]["name"]
    src_key  = rec["s3"]["object"]["key"]

    fname = os.path.basename(src_key)
    ext   = fname.rsplit(".", 1)[-1]
    is_img = ext.lower() in ("jpg", "jpeg", "png")
    is_vid = ext.lower() in ("mp4", "avi", "mov")
    if not (is_img or is_vid):
        return {"statusCode": 415, "msg": "unsupported file type"}

    # ── Create temp dir, pull user file & latest model ────────────────────────
    with tempfile.TemporaryDirectory() as tmp:
        local_file = os.path.join(tmp, fname)
        s3.download_file(src_bkt, src_key, local_file)

        local_model = _download_latest_model(tmp)
        # Tell image_video_tagger which weights to load
        os.environ["YOLO_WEIGHTS"] = local_model

        # Lazy import *after* env var is set so get_model() sees it
        iv = importlib.import_module("image_video_tagger")

        iv.OUT_DIR = tmp                    # force output into temp dir
        stem       = os.path.splitext(fname)[0]

        if is_img:
            iv.tag_image(local_file)
            annot_local = os.path.join(tmp, f"{stem}_annotated.{ext}")
        else:
            iv.tag_video(local_file)
            annot_local = os.path.join(tmp, f"{stem}_annotated.{ext}")

        if not os.path.exists(annot_local):
            raise FileNotFoundError(annot_local)

        # ── URLs & metadata ---------------------------------------------------
        org_url   = f"https://{src_bkt}.s3.{REGION}.amazonaws.com/{src_key}"
        thumb_key = src_key.replace("raw_uploads/", "thumbnails/", 1)
        thumb_url = f"https://{src_bkt}.s3.{REGION}.amazonaws.com/{thumb_key}"

        annot_key = f"{ANNOT_PREFIX}{os.path.basename(annot_local)}"
        s3.upload_file(annot_local, ANNOT_BUCKET, annot_key)
        annot_url = f"https://{ANNOT_BUCKET}.s3.{REGION}.amazonaws.com/{annot_key}"

        with open(annot_local + ".json") as fh:
            meta = json.load(fh)

        file_size = Decimal(os.path.getsize(local_file))
        duration  = None
        if is_vid:
            cap = cv2.VideoCapture(local_file)
            if cap.isOpened():
                fps     = cap.get(cv2.CAP_PROP_FPS) or 30
                frames  = cap.get(cv2.CAP_PROP_FRAME_COUNT)
                seconds = round(frames / fps, 1)
                duration = Decimal(str(seconds))
            cap.release()

        upload_time = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
        tags_dec    = {k: Decimal(str(v)) for k, v in meta["tags"].items()}

        item = {
            "uniqueId"     : upload_time,
            "uploadTime"   : upload_time,
            "deleted"      : False,
            "detected"     : meta["detected"],
            "fileSize"     : file_size,
            "format"       : ext,
            "mediaID"      : fname,
            "mediaType"    : meta["type"],
            "originalURL"  : org_url,
            "annotatedURL" : annot_url,
            "thumbnailURL" : thumb_url,
            "tags"         : tags_dec,
        }
        if duration is not None:
            item["duration"] = duration

        table.put_item(Item=item)
        return {"statusCode": 200, "meta": meta}