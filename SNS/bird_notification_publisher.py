import boto3
from urllib.parse import urlparse

sns = boto3.client('sns')
s3 = boto3.client('s3')

SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:651706776121:bird-tag-notifications'  # Replace with your SNS ARN

def lambda_handler(event, context):
    for record in event['Records']:
        if record['eventName'] != 'INSERT':
            continue

        new_image = record['dynamodb'].get('NewImage', {})

        media_id = new_image.get('mediaID', {}).get('S', '')
        upload_time = new_image.get('uploadTime', {}).get('S', '')
        tags_map = new_image.get('tags', {}).get('M', {})
        annotated_url = new_image.get('annotatedURL', {}).get('S', '')
        raw_url = new_image.get('originalURL', {}).get('S', '')

        if not tags_map:
            print("No tags found, skipping.")
            continue

        tag_names = list(tags_map.keys())

        # Extract bucket and key from URLs and generate presigned URLs
        annotated_presigned = None
        raw_presigned = None

        if annotated_url:
            bucket_name, key = extract_bucket_key_from_url(annotated_url)
            if bucket_name and key:
                annotated_presigned = generate_presigned_url(bucket_name, key)

        if raw_url:
            bucket_name, key = extract_bucket_key_from_url(raw_url)
            if bucket_name and key:
                raw_presigned = generate_presigned_url(bucket_name, key)

        for tag in tag_names:
            publish_to_sns(tag, media_id, upload_time, annotated_presigned, raw_presigned)

    return {
        'statusCode': 200,
        'body': 'Processed bird detection records.'
    }

def publish_to_sns(tag, media_id, upload_time, annotated_url, raw_url):
    tag_lower = tag.lower()

    message = f"""
A new bird sighting has been detected!

Species: {tag}
Media ID: {media_id}
Time: {upload_time}
"""

    if annotated_url:
        message += f"\nView Annotated Image: {annotated_url}"
    if raw_url:
        message += f"\nView Raw Image: {raw_url}"

    message += "\n\nThank you for using Bird Alert Service."

    try:
        response = sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Message=message,
            Subject="🐦 Bird Alert: New Sighting",
            MessageAttributes={
                'tag': {
                    'DataType': 'String',
                    'StringValue': tag_lower  # consistent lowercase for filter policy
                }
            }
        )
        print(f"Published notification for tag '{tag}': {response['MessageId']}")
    except Exception as e:
        print(f"Error publishing for tag '{tag}': {e}")

def extract_bucket_key_from_url(url):
    try:
        parsed_url = urlparse(url)
        # parsed_url.netloc example: birdtag-bucket154.s3.us-east-1.amazonaws.com
        bucket_name = parsed_url.netloc.split('.')[0]  # 'birdtag-bucket154'
        key = parsed_url.path.lstrip('/')  # removes leading '/'
        return bucket_name, key
    except Exception as e:
        print(f"Error extracting bucket/key from URL: {e}")
        return None, None

def generate_presigned_url(bucket, key, expiration=3600):
    try:
        url = s3.generate_presigned_url(
            ClientMethod='get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=expiration
        )
        return url
    except Exception as e:
        print(f"Error generating presigned URL: {e}")
        return None
