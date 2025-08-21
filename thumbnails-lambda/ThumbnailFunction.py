import boto3
import cv2
import os

s3 = boto3.client('s3')

def lambda_handler(event, context):
    # Get bucket and key from S3 event
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']
    
    if key.startswith("thumbnails/"):
        print("Thumbnail already done, skipping.")
        return

    # Download image to /tmp
    download_path = f'/tmp/{os.path.basename(key)}'
    s3.download_file(bucket, key, download_path)

    # Read and resize image
    img = cv2.imread(download_path)
    h, w = img.shape[:2]
    scale = 200.0 / max(h, w)
    resized = cv2.resize(img, (int(w*scale), int(h*scale)))
    
    # Save thumbnail
    thumb_path = f'/tmp/thumb_{os.path.basename(key)}'
    cv2.imwrite(thumb_path, resized, [cv2.IMWRITE_JPEG_QUALITY, 75])

    # Upload thumbnail
    thumb_key = f'thumbnails/{os.path.basename(key)}'
    s3.upload_file(thumb_path, bucket, thumb_key)

    print(f"Thumbnail created: {thumb_key}")