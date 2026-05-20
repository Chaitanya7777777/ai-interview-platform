#!/usr/bin/env python
"""Test script to verify Groq integration."""
import asyncio
import sys
sys.path.insert(0, 'C:\\Users\\Chaitanya Gulechha\\Desktop\\resume-analyser\\backend')

from app.core.config import settings
from app.services.ai_service import ai_service

async def test_groq():
    print("Testing Groq AI Service Integration")
    print("=" * 50)
    print(f"AI Provider: {settings.ai_provider}")
    print(f"Groq API Key (first 10 chars): {settings.groq_api_key[:10]}...")
    print(f"Groq Model: {settings.groq_model}")
    print("=" * 50)
    
    # Simple test resume
    test_resume = """
    John Doe
    Software Engineer with 5 years experience
    Skills: Python, JavaScript, FastAPI, React
    """
    
    try:
        print("\nCalling ai_service.analyze_resume()...")
        result, is_fallback = await ai_service.analyze_resume(test_resume)
        
        print(f"\nSuccess! Got result (fallback={is_fallback}):")
        print(f"  Overall Score: {result.overall_score}")
        print(f"  Strengths: {result.strengths[:2] if result.strengths else 'N/A'}")
        print(f"  Weaknesses: {result.weaknesses[:2] if result.weaknesses else 'N/A'}")
        print(f"  Missing Skills: {result.missing_skills[:2] if result.missing_skills else 'N/A'}")
        print(f"  Recommended Roles: {result.recommended_roles[:2] if result.recommended_roles else 'N/A'}")
        return True
        
    except Exception as e:
        print(f"\nError: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_groq())
    sys.exit(0 if success else 1)
