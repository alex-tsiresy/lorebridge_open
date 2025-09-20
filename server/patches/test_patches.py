#!/usr/bin/env python3
"""
Test script to verify that patches have been applied correctly.
This script should be run inside the Docker container to verify patch application.
"""

import sys
import traceback


def test_firecrawl_import():
    """Test that firecrawl can be imported without Pydantic v2 errors."""
    try:
        print("Testing firecrawl import...")
        import firecrawl
        print("✅ firecrawl module imported successfully")
        
        print("Testing Firecrawl class import...")
        from firecrawl import Firecrawl
        print("✅ Firecrawl class imported successfully")
        
        print("Testing Firecrawl instance creation...")
        instance = Firecrawl(api_key="test-key")
        print("✅ Firecrawl instance created successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Firecrawl test failed: {e}")
        print(f"Error type: {type(e).__name__}")
        traceback.print_exc()
        return False


def test_firecrawl_service():
    """Test that our firecrawl service loads correctly."""
    try:
        print("Testing FirecrawlService import...")
        from app.services.content.firecrawl_service import firecrawl_service
        print("✅ FirecrawlService imported successfully")
        
        # Note: Service may not be available due to missing API key, but should not crash
        print(f"Service available: {firecrawl_service.is_available()}")
        print("✅ FirecrawlService instantiated successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ FirecrawlService test failed: {e}")
        print(f"Error type: {type(e).__name__}")
        traceback.print_exc()
        return False


def main():
    """Run all patch verification tests."""
    print("=" * 50)
    print("PATCH VERIFICATION TESTS")
    print("=" * 50)
    
    tests = [
        test_firecrawl_import,
        test_firecrawl_service,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        print(f"\nRunning {test.__name__}...")
        print("-" * 30)
        if test():
            passed += 1
            print(f"✅ {test.__name__} PASSED")
        else:
            print(f"❌ {test.__name__} FAILED")
    
    print("\n" + "=" * 50)
    print(f"RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL PATCHES WORKING CORRECTLY!")
        sys.exit(0)
    else:
        print("❌ SOME PATCHES FAILED!")
        sys.exit(1)


if __name__ == "__main__":
    main()