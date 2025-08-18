import requests
import json

# Test OpenRouter API directly
url = "https://openrouter.ai/api/v1/chat/completions"

payload = {
    "model": "deepseek/deepseek-r1",
    "messages": [
        {
            "role": "user",
            "content": "Hello, this is a test"
        }
    ],
    "temperature": 0.7,
    "max_tokens": 100
}

headers = {
    "Authorization": "Bearer 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",
    "Content-Type": "application/json"
}

try:
    print("Testing OpenRouter API directly...")
    response = requests.post(url, json=payload, headers=headers, timeout=120)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    
    if response.status_code == 200:
        result = response.json()
        print("Success!")
        print(f"Full response structure: {json.dumps(result, indent=2)}")
        if 'choices' in result and len(result['choices']) > 0:
            choice = result['choices'][0]
            if 'message' in choice:
                print(f"AI Response: {choice['message'].get('content', 'No content')}")
            else:
                print(f"No message in choice: {choice}")
        print(f"Usage: {result.get('usage', {})}")
    else:
        print("Error!")
        print(f"Response: {response.text}")
        
except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")
