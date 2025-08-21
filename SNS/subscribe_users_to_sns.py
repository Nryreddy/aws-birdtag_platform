import boto3
import json

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

USER_TABLE_NAME = 'userDetails-Alert'
SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:651706776121:bird-tag-notifications'

user_table = dynamodb.Table(USER_TABLE_NAME)

def lambda_handler(event, context):
    for record in event['Records']:
        eventName = record['eventName']
        new_image = record.get('dynamodb', {}).get('NewImage', {})
        old_image = record.get('dynamodb', {}).get('OldImage', {})

        email = get_value(new_image, 'email') or get_value(old_image, 'email')
        new_tags = get_list(new_image, 'tags')
        old_tags = get_list(old_image, 'tags')
        subscription_arn = get_value(new_image, 'subscriptionArn') or get_value(old_image, 'subscriptionArn')

        if eventName == 'INSERT':
            print(f"INSERT detected for {email} with tags {new_tags}")
            arn = subscribe_user(email, new_tags)
            if arn:
                save_subscription_arn(email, arn)

        elif eventName == 'MODIFY':
            print(f"MODIFY detected for {email}")
            if set(new_tags) != set(old_tags):
                print(f"Tags changed for {email}, updating subscription")
                if subscription_arn:
                    unsubscribe_user(subscription_arn)
                arn = subscribe_user(email, new_tags)
                if arn:
                    save_subscription_arn(email, arn)
            else:
                print("Tags not changed, no action taken")

        elif eventName == 'REMOVE':
            print(f"REMOVE detected for {email}")
            if subscription_arn:
                unsubscribe_user(subscription_arn)
                remove_subscription_arn(email)

def get_value(image, key):
    try:
        if key in image:
            val_type = list(image[key].keys())[0]
            if val_type == 'S':
                return image[key]['S']
            elif val_type == 'N':
                return image[key]['N']
            elif val_type == 'BOOL':
                return image[key]['BOOL']
    except:
        pass
    return None

def get_list(image, key):
    try:
        if key in image and 'L' in image[key]:
            return [item['S'].lower() for item in image[key]['L']]  # Lowercase here
    except:
        pass
    return []

def subscribe_user(email, tags):
    filter_policy = {
    "tags": [tag.lower() for tag in tags]
}
    print(f"Subscribing {email} with tags {tags}")
    try:
        response = sns.subscribe(
            TopicArn=SNS_TOPIC_ARN,
            Protocol='email',
            Endpoint=email,
            Attributes={
                'FilterPolicy': json.dumps(filter_policy)
            }
        )
        arn = response.get('SubscriptionArn')
        print(f"Subscription ARN: {arn}")
        return arn
    except Exception as e:
        print(f"Error subscribing {email}: {e}")
        return None

def unsubscribe_user(subscription_arn):
    print(f"Unsubscribing subscription {subscription_arn}")
    try:
        sns.unsubscribe(SubscriptionArn=subscription_arn)
    except Exception as e:
        print(f"Error unsubscribing {subscription_arn}: {e}")

def save_subscription_arn(email, subscription_arn):
    print(f"Saving subscription ARN for {email}")
    try:
        user_table.update_item(
            Key={'email': email},
            UpdateExpression='SET subscriptionArn = :arn',
            ExpressionAttributeValues={':arn': subscription_arn}
        )
    except Exception as e:
        print(f"Error saving subscription ARN for {email}: {e}")

def remove_subscription_arn(email):
    print(f"Removing subscription ARN for {email}")
    try:
        user_table.update_item(
            Key={'email': email},
            UpdateExpression='REMOVE subscriptionArn'
        )
    except Exception as e:
        print(f"Error removing subscription ARN for {email}: {e}")
