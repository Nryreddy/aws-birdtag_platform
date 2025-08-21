import os, tempfile, json, logging, boto3
from datetime import datetime, timezone
from decimal import Decimal
from audio_tagger import main as run_birdnet
import subprocess

log = logging.getLogger()
log.setLevel(logging.INFO)

MODEL_BUCKET = os.environ["MODEL_BUCKET"]
MODEL_PREFIX = os.getenv("MODEL_PREFIX", "birdnet-audio-model/")
TABLE_NAME   = os.environ["TABLE_NAME"]

REGION = "us-east-1"
s3     = boto3.client("s3")
table  = boto3.resource("dynamodb", region_name=REGION).Table(TABLE_NAME)

def _download_latest_model(tmpdir: str) -> tuple[str, str]:
    """
    Pick the most-recent .tflite and the most-recent .txt under
    MODEL_BUCKET / MODEL_PREFIX and return their LOCAL paths.
    """
    resp   = s3.list_objects_v2(Bucket=MODEL_BUCKET, Prefix=MODEL_PREFIX)
    objs   = resp.get("Contents", [])

    # newest model
    models = [o for o in objs if o["Key"].lower().endswith(".tflite")]
    if not models:
        raise RuntimeError("No .tflite model found in S3")
    mod_obj = max(models, key=lambda o: o["LastModified"])

    # newest label file
    labels = [o for o in objs if o["Key"].lower().endswith(".txt")]
    if not labels:
        raise RuntimeError("No .txt label file found in S3")
    lab_obj = max(labels, key=lambda o: o["LastModified"])

    # local paths
    local_model = os.path.join(tmpdir, os.path.basename(mod_obj["Key"]))
    local_label = os.path.join(tmpdir, os.path.basename(lab_obj["Key"]))

    # download
    s3.download_file(MODEL_BUCKET, mod_obj["Key"], local_model)
    s3.download_file(MODEL_BUCKET, lab_obj["Key"], local_label)

    print(f"[INFO] Using model : s3://{MODEL_BUCKET}/{mod_obj['Key']}")
    print(f"[INFO] Using labels: s3://{MODEL_BUCKET}/{lab_obj['Key']}")
    return local_model, local_label



def convert_mp3_to_wav(mp3_path, wav_path):
    # Uses ffmpeg to convert mp3 to wav (mono, 48kHz)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", mp3_path, "-ac", "1", "-ar", "48000", wav_path
    ]
    subprocess.check_call(cmd)


def lambda_handler(event, _ctx):
    rec = event["Records"][0]
    bucket = rec["s3"]["bucket"]["name"]
    key    = rec["s3"]["object"]["key"]
    fname  = os.path.basename(key)
    ext    = os.path.splitext(fname)[1].lstrip(".").lower()

    if ext not in ("wav", "mp3","flac", "m4a", "ogg"):
        log.warning("Unsupported file type: %s", ext)
        return {"statusCode": 415, "msg": "unsupported file type"}

    with tempfile.TemporaryDirectory() as tmp:
        local_audio = os.path.join(tmp, fname)
        s3.download_file(bucket, key, local_audio)
        model_path, label_path = _download_latest_model(tmp)


        tags, duration = run_birdnet(local_audio, model_path, label_path)
        detected = bool(tags)

        upload_time = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
        item = {
            "uniqueId"     : upload_time,
            "uploadTime"   : upload_time,
            "deleted"      : False,
            "detected"     : detected,
            "fileSize"     : Decimal(os.path.getsize(local_audio)),
            "format"       : ext,
            "mediaID"      : fname,
            "mediaType"    : "audio",
            "originalURL"  : f"https://{bucket}.s3.{REGION}.amazonaws.com/{key}",
            "annotatedURL" : None,
            "thumbnailURL" : None,
            "tags"         : {k: Decimal(1) for k in tags},
            "duration"     : Decimal(str(duration))
        }

        table.put_item(Item=item)
        log.info("DynamoDB item written")

        return {"statusCode": 200,
                "meta": {"file": fname, "detected": detected, "tags": tags}}
