"""
API authentication helpers
"""

import hmac
import hashlib
import time


def verify_webhook_signature(payload_body, signature, secret):
    """
    Verify a webhook signature using HMAC-SHA256.
    Used for incoming webhooks that trigger tasks.
    """
    expected = hmac.new(
        secret.encode('utf-8'),
        payload_body.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(f"sha256={expected}", signature)


def generate_api_key(user_id, secret):
    """Generate a deterministic API key for a user"""
    data = f"{user_id}:{secret}:{int(time.time() / 86400)}"
    return hashlib.sha256(data.encode()).hexdigest()
