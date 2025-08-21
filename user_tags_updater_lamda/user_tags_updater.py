import json
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('userDetails-Alert')

def lambda_handler(event, context):
    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            },
            'body': ''
        }

    http_method = event.get('httpMethod')
    path = event.get('path')

    if http_method == 'POST' and path == '/sns-alert':
        try:
            body = json.loads(event.get('body', '{}'))
            email = body.get('email')
            new_tags = body.get('values')

            if not email or not isinstance(email, str):
                return respond(400, "Invalid or missing 'email' field.")
            if not new_tags or not isinstance(new_tags, list):
                return respond(400, "Invalid or missing 'values' field. It must be a list.")

            # Fetch existing item from DynamoDB
            response = table.get_item(Key={'email': email})
            existing_tags = response.get('Item', {}).get('tags', [])

            # Merge tags uniquely
            combined_tags = list(set(existing_tags) | set(new_tags))

            # Update DynamoDB with merged tags
            table.update_item(
                Key={'email': email},
                UpdateExpression='SET tags = :tags',
                ExpressionAttributeValues={':tags': combined_tags},
                ReturnValues='UPDATED_NEW'
            )

            # Return updated tags in the response
            return respond(200, "Tags updated successfully.", {'tags': combined_tags})

        except json.JSONDecodeError:
            return respond(400, "Invalid JSON in request body.")
        except ClientError as e:
            return respond(500, f"DynamoDB error: {e.response['Error']['Message']}")
        except Exception as e:
            return respond(500, f"Unexpected error: {str(e)}")

    # If other routes or methods, return 404
    return respond(404, "Route not found or method not supported.")


def respond(status_code, message, data=None):
    body = {'message': message}
    if data:
        body.update(data)
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',  # adjust for your CORS policy
            'Content-Type': 'application/json',
        },
        'body': json.dumps(body)
    }
