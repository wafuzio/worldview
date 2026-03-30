#!/usr/bin/env python3
"""
Example usage of the llm_client in your Politics project.

Run with: python3 example_usage.py
"""

from llm_client import RelayClient, chat, stream_chat

def example_simple_usage():
    """Simple one-shot chat examples."""
    print("=== Simple Chat Examples ===")
    
    # Basic usage
    response = chat("What are the main political ideologies in the US?")
    print(f"Response: {response[:100]}...")
    
    # With specific model
    response = chat(
        "Explain the difference between conservative and liberal viewpoints.",
        model="gpt-5.4-2026-03-05",
        temperature=0.3
    )
    print(f"Response: {response[:100]}...")

def example_client_usage():
    """Using the RelayClient for more control."""
    print("\n=== Client Usage Examples ===")
    
    client = RelayClient()
    
    # Multi-turn conversation
    messages = [
        {"role": "user", "content": "I'm researching political polarization."},
        {"role": "assistant", "content": "Political polarization is the growing divide between political parties and ideologies."},
        {"role": "user", "content": "What are the main causes?"}
    ]
    
    response = client.complete(messages=messages)
    print(f"Conversation response: {response[:100]}...")
    
    # Streaming example
    print("\nStreaming response:")
    for chunk in client.stream("Summarize key political events of 2024:", max_tokens=150):
        print(chunk, end="", flush=True)
    print()

def example_political_analysis():
    """Example for political content analysis."""
    print("\n=== Political Analysis Example ===")
    
    client = RelayClient()
    
    # Analyze political text
    political_text = """
    The recent election cycle has highlighted deep divisions in American society.
    Voters are increasingly sorted along ideological lines, with geographic and
    cultural factors reinforcing political preferences.
    """
    
    analysis = client.complete(
        f"Analyze this political text for bias and tone: {political_text}",
        temperature=0.1  # Lower temperature for more objective analysis
    )
    
    print(f"Analysis: {analysis}")

if __name__ == "__main__":
    print("Running llm_client examples...\n")
    
    # Note: These require ALCHEMY_API_KEY to be set in your environment
    try:
        example_simple_usage()
        example_client_usage()
        example_political_analysis()
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure ALCHEMY_API_KEY is set in your .env file")
