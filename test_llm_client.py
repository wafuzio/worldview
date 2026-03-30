#!/usr/bin/env python3
"""
Simple test script for the llm_client module.

Run with: python test_llm_client.py
"""

from llm_client import RelayClient, chat, list_models

def test_model_listing():
    """Test the model catalog functionality."""
    print("=== Available Models ===")
    models = list_models(chat_only=True)
    for model in models:
        print(f"{model.id}: {model.display_name} ({model.tier}) - {model.status}")

def test_simple_chat():
    """Test a simple chat completion."""
    print("\n=== Simple Chat Test ===")
    try:
        response = chat("Say hello in one sentence.")
        print(f"Response: {response}")
    except Exception as e:
        print(f"Error: {e}")

def test_client_streaming():
    """Test streaming with a client instance."""
    print("\n=== Streaming Test ===")
    try:
        client = RelayClient()
        print("Streaming: ", end="", flush=True)
        for chunk in client.stream("Count to 5 slowly."):
            print(chunk, end="", flush=True)
        print()  # newline
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Testing llm_client functionality...")
    
    # Test model listing (doesn't require API key)
    test_model_listing()
    
    # These tests require ALCHEMY_API_KEY to be set
    # Uncomment to test with real API calls
    
    # test_simple_chat()
    # test_client_streaming()
    
    print("\nTo test with real API calls:")
    print("1. Set ALCHEMY_API_KEY in your environment")
    print("2. Uncomment the test functions above")
    print("3. Run this script again")
