# Third-Party Library Patches

This directory contains patches for third-party libraries to fix compatibility issues or bugs that haven't been resolved upstream.

## Patches

### `firecrawl-py-pydantic-v2-fix.patch`

**Library**: firecrawl-py v4.1.0  
**Issue**: Pydantic v2 compatibility - field validator placed in wrong class  
**Description**: 

The firecrawl-py library has a `@field_validator('parsers')` decorator incorrectly placed in the `SearchRequest` class, but the `parsers` field actually exists in the `ScrapeOptions` class. This causes Pydantic v2 validation to fail with:

```
PydanticUserError: Decorators defined with incorrect fields: 
firecrawl.v2.types.SearchRequest.validate_parsers 
(use check_fields=False if you're inheriting from the model and intended this)
```

**Fix**: 
- Moves the `validate_parsers` method from `SearchRequest` to `ScrapeOptions` class
- Removes the duplicate method that was causing the validation error

**Files Modified**: 
- `firecrawl/v2/types.py`

**Status**: ✅ Applied automatically during Docker build via `apply_firecrawl_fix.sh`  
**Upstream**: Issue not yet resolved in firecrawl-py repository  
**Verification**: Tested successfully with automated test suite in `test_patches.py`

## Patch Application

Patches are automatically applied during Docker container build process. See the `Dockerfile` for the specific application steps.

## Adding New Patches

1. Create patch file in this directory using standard unified diff format
2. Add documentation to this README
3. Update Dockerfile to apply the patch during build
4. Test with `docker compose up --build`

## Maintenance

- Monitor upstream repositories for official fixes
- Remove patches when upstream issues are resolved
- Update patch files if library versions change