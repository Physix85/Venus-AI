#!/usr/bin/env python3
"""
Simple test script to check if the AI service can start
"""
import os
import sys

print("🔍 Testing Venus AI Service Startup...")
print(f"Python version: {sys.version}")
print(f"Current directory: {os.getcwd()}")

# Check if .env file exists
env_file = "ai-service/.env"
if os.path.exists(env_file):
    print(f"✅ Found .env file: {env_file}")
    with open(env_file, 'r') as f:
        content = f.read()
        if "DEEPSEEK_API_KEY=" in content:
            print("✅ DEEPSEEK_API_KEY found in .env")
            # Check if it's still the placeholder
            if "your-deepseek-api-key-here" in content:
                print("❌ API key is still placeholder value")
            else:
                print("✅ API key appears to be configured")
        else:
            print("❌ DEEPSEEK_API_KEY not found in .env")
else:
    print(f"❌ .env file not found: {env_file}")

# Try to import the main module
print("\n🧪 Testing module imports...")
try:
    sys.path.insert(0, 'ai-service')
    print("Importing os and basic modules...")
    
    print("Importing pydantic...")
    from pydantic import BaseModel
    
    print("Importing fastapi...")
    from fastapi import FastAPI
    
    print("Importing pydantic_settings...")
    from pydantic_settings import BaseSettings
    
    print("✅ All basic imports successful")
    
    # Try to load settings
    print("\n⚙️ Testing settings loading...")
    
    # Set environment variable for testing
    os.environ['DEEPSEEK_API_KEY'] = 'sk-test-key-for-startup-testing'
    
    from main import Settings
    print("✅ Settings class imported successfully")
    
    settings = Settings()
    print("✅ Settings loaded successfully!")
    print(f"Service will run on: {settings.service_host}:{settings.service_port}")
    
except Exception as e:
    print(f"❌ Error during import/setup: {e}")
    import traceback
    traceback.print_exc()

print("\n🎯 Test complete!")
