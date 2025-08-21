import json
import boto3
import base64
from decimal import Decimal
from boto3.dynamodb.conditions import Attr
from urllib.parse import urlparse

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client('s3')
table = dynamodb.Table('BirdAnalyiser')

def generate_presigned_url(bucket, key, expiration=3600):
    try:
        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=expiration
        )
        return url
    except Exception as e:
        print(f"Error generating presigned URL for {bucket}/{key}: {e}")
        return None

def decimal_to_native(obj):
    if isinstance(obj, list):
        return [decimal_to_native(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_native(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    else:
        return obj

def parse_tag_count_query(params):
    tag_counts = {}
    i = 1
    while f'tag{i}' in params and f'count{i}' in params:
        tag = params.get(f'tag{i}').strip()
        try:
            count = int(params.get(f'count{i}'))
            if tag and count > 0:
                tag_counts[tag] = count
        except:
            pass
        i += 1
    return tag_counts

def extract_tags_from_file(file_bytes):
    # Replace with actual ML model logic
    return {"crow": 1, "pigeon": 2}

def extract_bucket_key_from_url(url):
    parsed = urlparse(url)
    bucket = parsed.netloc.split('.')[0]
    key = parsed.path.lstrip('/')
    return bucket, key

def build_cors_response(status_code, body_dict):
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body_dict)
    }

def get_presigned_url_from_s3_url(s3_url):
    try:
        bucket, key = extract_bucket_key_from_url(s3_url)
        presigned_url = generate_presigned_url(bucket, key)
        if presigned_url:
            return presigned_url
        else:
            return s3_url
    except Exception as e:
        print(f"Failed to generate presigned URL for {s3_url}: {e}")
        return s3_url  # fallback to original URL

def lambda_handler(event, context):
    if event['httpMethod'] == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            },
            'body': ''
        }

    print("Event received:", json.dumps(event))
    http_method = event.get('httpMethod')
    path = event.get('path')

    # ---------- /delete-files POST ----------
    if path == '/delete-files' and http_method == 'POST':
        try:
            body = json.loads(event.get('body') or '{}')
            urls = body.get('urls') or body.get('thumbnailURL')

            if isinstance(urls, str):
                urls = [urls]
            elif not isinstance(urls, list):
                return build_cors_response(400, {'error': 'Invalid or missing "urls" or "thumbnailURL"'})

            deleted_urls = []

            for url in urls:
                if not isinstance(url, str) or not url.strip():
                    continue

                # Scan for record that contains this URL in any field
                response = table.scan(
                    FilterExpression=Attr('thumbnailURL').eq(url) |
                                    Attr('originalURL').eq(url) |
                                    Attr('annotatedURL').eq(url)
                )
                items = response.get('Items', [])
                for item in items:
                    # Collect all 3 URLs from the item
                    file_urls = [item.get('thumbnailURL'), item.get('originalURL'), item.get('annotatedURL')]
                    file_urls = [u for u in file_urls if u]

                    # Delete DB entry
                    try:
                        table.delete_item(Key={'uniqueId': item['uniqueId']})
                        deleted_urls.append(url)
                    except Exception as e:
                        print(f"Failed to delete DynamoDB record for {url}: {e}")
                        continue

                    # Delete S3 files
                    for file_url in file_urls:
                        try:
                            bucket, key = extract_bucket_key_from_url(file_url)
                            s3.delete_object(Bucket=bucket, Key=key)
                            print(f"Deleted from S3: {bucket}/{key}")
                        except Exception as e:
                            print(f"Failed to delete {file_url} from S3: {e}")

            return build_cors_response(200, {'message': 'Deletion completed'})

        except Exception as e:
            print("Error in /delete-files:", str(e))
            return build_cors_response(500, {'error': 'Internal server error'})

    # ---------- /modify-tags POST ----------
    if path == '/modify-tags' and http_method == 'POST':
        try:
            body = json.loads(event.get('body') or '{}')
            urls = body.get('url')
            operation = body.get('operation')
            tags = body.get('tags')

            if not isinstance(urls, list) or not all(isinstance(u, str) for u in urls):
                return build_cors_response(400, {'error': 'Invalid or missing "url" list'})
            if operation not in (0, 1):
                return build_cors_response(400, {'error': 'Invalid or missing "operation", must be 0 or 1'})
            if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
                return build_cors_response(400, {'error': 'Invalid or missing "tags" list'})

            parsed_tags = {}
            for t in tags:
                parts = t.split(',')
                if len(parts) == 2:
                    tag_name = parts[0].strip()
                    try:
                        tag_count = int(parts[1].strip())
                        if tag_name and tag_count > 0:
                            parsed_tags[tag_name] = tag_count
                    except:
                        pass

            if not parsed_tags:
                return build_cors_response(400, {'error': 'No valid tags to add/remove'})

            updated_files = []
            for url in urls:
                response = table.scan(
                    FilterExpression=Attr('thumbnailURL').eq(url)
                )
                items = response.get('Items', [])
                if not items:
                    continue

                item = items[0]
                tags_dict = item.get('tags', {})
                if not isinstance(tags_dict, dict):
                    tags_dict = {}

                if operation == 1:
                    for tag, count in parsed_tags.items():
                        tags_dict[tag] = tags_dict.get(tag, 0) + count
                else:
                    for tag, count in parsed_tags.items():
                        if tag in tags_dict:
                            new_count = tags_dict[tag] - count
                            if new_count > 0:
                                tags_dict[tag] = new_count
                            else:
                                tags_dict.pop(tag, None)

                try:
                    table.update_item(
                        Key={'uniqueId': item['uniqueId']},
                        UpdateExpression='SET tags = :newtags',
                        ExpressionAttributeValues={':newtags': tags_dict}
                    )
                    updated_files.append(url)
                except Exception as e:
                    print(f"Error updating tags for {url}: {str(e)}")

            presigned_urls = [get_presigned_url_from_s3_url(url) for url in updated_files]
            return build_cors_response(200, {'updated': presigned_urls})

        except Exception as e:
            print("Error in /modify-tags:", str(e))
            return build_cors_response(500, {'error': 'Internal server error'})

    # ---------- /query-by-file POST ----------
    if path == '/query-by-file' and http_method == 'POST':
        try:
            body = json.loads(event.get('body') or '{}')
            file_base64 = body.get('file')
            if not file_base64 or not isinstance(file_base64, str):
                return build_cors_response(400, {'error': 'Missing or invalid "file" field'})

            file_bytes = base64.b64decode(file_base64)
            detected_tags = extract_tags_from_file(file_bytes)
            if not detected_tags:
                return build_cors_response(400, {'error': 'No tags detected in file'})

            response = table.scan()
            items = response.get('Items', [])
            matching_links = []

            for item in items:
                item = decimal_to_native(item)
                tags = item.get('tags', {})
                if not isinstance(tags, dict):
                    continue
                if all(tag in tags for tag in detected_tags):
                    for url_field in ['thumbnailURL', 'originalURL', 'annotatedURL']:
                        if item.get(url_field):
                            presigned_url = get_presigned_url_from_s3_url(item[url_field])
                            matching_links.append(presigned_url)

            return build_cors_response(200, {'links': matching_links})

        except Exception as e:
            print("Error processing /query-by-file:", str(e))
            return build_cors_response(500, {'error': 'Internal server error'})

    # ---------- /search GET or POST ----------

    if path != '/search':
        return build_cors_response(404, {'error': 'Route not found'})

    if http_method == 'GET':
        params = event.get('queryStringParameters') or {}
    elif http_method == 'POST':
        try:
            params = json.loads(event.get('body') or '{}')
        except Exception as e:
            print("Error parsing POST body:", str(e))
            return build_cors_response(400, {'error': 'Invalid JSON body'})
    else:
        return build_cors_response(405, {'error': f'Method {http_method} not allowed'})

    # Search by unique id
    if 'id' in params:
        unique_id = params['id']
        if isinstance(unique_id, str):
            unique_id = unique_id.strip('"')
        else:
            return build_cors_response(400, {'error': 'Invalid id parameter'})
        try:
            response = table.get_item(Key={'uniqueId': unique_id})
            item = response.get('Item')
            if not item:
                return build_cors_response(404, {'error': 'Item not found'})
            item = decimal_to_native(item)
            filtered_item = {
                'thumbnailURL': get_presigned_url_from_s3_url(item.get('thumbnailURL')),
                'tags': item.get('tags')
            }
            return build_cors_response(200, filtered_item)
        except Exception as e:
            print("Error querying DynamoDB:", str(e))
            return build_cors_response(500, {'error': 'Internal server error'})

    # Search by thumbnailURL
    if 'thumbnailURL' in params:
        thumbnail_url = params['thumbnailURL']
        if not isinstance(thumbnail_url, str) or not thumbnail_url:
            return build_cors_response(400, {'error': 'Invalid or missing thumbnailURL'})
        try:
            response = table.scan(
                FilterExpression=Attr('thumbnailURL').eq(thumbnail_url)
            )
            items = response.get('Items', [])
            if not items:
                return build_cors_response(404, {'error': 'Thumbnail not found'})
            item = decimal_to_native(items[0])
            original_url = item.get('originalURL')
            if not original_url:
                return build_cors_response(404, {'error': 'Original URL not found'})
            presigned_original = get_presigned_url_from_s3_url(original_url)
            return build_cors_response(200, {'originalURL': presigned_original})
        except Exception as e:
            print("Error scanning for thumbnailURL:", str(e))
            return build_cors_response(500, {'error': 'Internal server error'})

    # Parse tag+count queries (only for GET)
    tag_counts = parse_tag_count_query(params) if http_method == 'GET' else {}

    # If no tag_counts from parse but all params values are int, treat all params as tag counts
    if not tag_counts and all(isinstance(v, int) for v in params.values()):
        tag_counts = {k: v for k, v in params.items() if isinstance(v, int)}

    # Function to sum counts of matching tags (case-insensitive substring match)
    def sum_matching_tags(tags_dict, query_tag):
        query_tag_lower = query_tag.lower()
        total_count = 0
        for tag_name, tag_count in tags_dict.items():
            if query_tag_lower in tag_name.lower():
                total_count += tag_count
        return total_count

    if tag_counts:
        try:
            response = table.scan()
            items = response.get('Items', [])
            filtered_links = []

            for item in items:
                item = decimal_to_native(item)
                item_tags = item.get('tags', {})
                if not isinstance(item_tags, dict):
                    continue

                # Check if all requested tag counts match with case-insensitive substring
                if all(sum_matching_tags(item_tags, tag) >= count for tag, count in tag_counts.items()):
                    for url_field in ['thumbnailURL', 'originalURL', 'annotatedURL']:
                        if item.get(url_field):
                            presigned_url = get_presigned_url_from_s3_url(item[url_field])
                            filtered_links.append(presigned_url)

            return build_cors_response(200, {'links': filtered_links})

        except Exception as e:
            print("Error scanning DynamoDB:", str(e))
            return build_cors_response(500, {'error': 'Internal server error'})

    # Search by tag(s) only (no counts)
    elif 'tag' in params:
        raw_tags = params['tag']
        if isinstance(raw_tags, str):
            requested_tags = [t.strip().lower() for t in raw_tags.split(',') if t.strip()]
        elif isinstance(raw_tags, list):
            requested_tags = [str(t).strip().lower() for t in raw_tags if str(t).strip()]
        else:
            return build_cors_response(400, {'error': 'Invalid tag parameter'})

        if not requested_tags:
            return build_cors_response(400, {'error': 'Missing or empty tag parameter'})

        try:
            response = table.scan()
            items = response.get('Items', [])
            filtered_links = []

            for item in items:
                item = decimal_to_native(item)
                item_tags = item.get('tags', {})

                if isinstance(item_tags, dict):
                    # Return item if any requested tag substring is found in item tags (case-insensitive)
                    if any(any(req_tag in tag_name.lower() for tag_name in item_tags) for req_tag in requested_tags):
                        for url_field in ['thumbnailURL', 'originalURL', 'annotatedURL']:
                            if item.get(url_field):
                                presigned_url = get_presigned_url_from_s3_url(item[url_field])
                                filtered_links.append(presigned_url)

            return build_cors_response(200, {'links': filtered_links})

        except Exception as e:
            print("Error scanning DynamoDB:", str(e))
            return build_cors_response(500, {'error': 'Internal server error'})

    return build_cors_response(400, {'error': 'Missing valid parameters (id, tag, tag+count, thumbnailURL, or file)'})

