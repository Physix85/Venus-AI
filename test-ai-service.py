import requests
import json

# Test the AI service directly with a simple request first
url = "http://localhost:8001/chat/completions"

# Simple test without system prompt
payload = {
    "messages": [
        {
            "role": "user",
            "content": "Hello"
        }
    ],
    "model": "deepseek/deepseek-r1",
    "temperature": 0.7,
    "max_tokens": 100
}

headers = {
    "Content-Type": "application/json"
}

try:
    print("Testing AI service with simple request...")
    response = requests.post(url, json=payload, headers=headers, timeout=120)

    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")

    if response.status_code == 200:
        result = response.json()
        print("Success!")
        print(f"AI Response: {result['choices'][0]['message']['content']}")
        print(f"Usage: {result.get('usage', {})}")
    else:
        print("Error!")
        print(f"Response: {response.text}")

except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")

print("\n" + "="*50 + "\n")

# Now test with system prompt like the backend sends
payload2 = {
    "messages": [
        {
            "role": "system",
            "content": "You are Venus AI, a helpful and intelligent assistant."
        },
        {
            "role": "user",
            "content": "Hi how are you ?"
        }
    ],
    "model": "deepseek/deepseek-r1",
    "temperature": 0.7,
    "max_tokens": 2048
}

try:
    print("Testing AI service with system prompt...")
    response = requests.post(url, json=payload2, headers=headers, timeout=120)

    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")

    if response.status_code == 200:
        result = response.json()
        print("Success!")
        print(f"AI Response: {result['choices'][0]['message']['content']}")
        print(f"Usage: {result.get('usage', {})}")
    else:
        print("Error!")
        print(f"Response: {response.text}")

except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")
