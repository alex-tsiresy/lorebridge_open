#!/bin/bash
set -e

echo "Applying firecrawl-py Pydantic v2 compatibility fix..."

cd .venv/lib/python3.11/site-packages/firecrawl/v2

# Create backup
cp types.py types.py.backup

echo "Adding validate_parsers method to ScrapeOptions class..."

# Create the method content in a temporary file
cat > /tmp/validate_parsers_method.txt << 'EOF'

    @field_validator('parsers')
    @classmethod
    def validate_parsers(cls, v):
        """Validate and normalize parsers input."""
        if v is None:
            return v
        
        normalized_parsers = []
        for parser in v:
            if isinstance(parser, str):
                normalized_parsers.append(parser)
            elif isinstance(parser, dict):
                normalized_parsers.append(PDFParser(**parser))
            elif isinstance(parser, PDFParser):
                normalized_parsers.append(parser)
            else:
                raise ValueError(f"Invalid parser format: {parser}")
        
        return normalized_parsers
EOF

# Add the method after the validate_formats method in ScrapeOptions class
awk '
/raise ValueError.*Expected ScrapeFormats/ {
    print $0
    while ((getline line < "/tmp/validate_parsers_method.txt") > 0) {
        print line
    }
    close("/tmp/validate_parsers_method.txt")
    next
}
{print}
' types.py > types.py.tmp

mv types.py.tmp types.py

echo "Removing any duplicate validate_parsers from SearchRequest class..."
# Remove the duplicate method if it exists
sed -i '/class SearchRequest/,/^class / { /@field_validator.*parsers/,/return normalized_parsers/d }' types.py

echo "Cleaning up temporary files..."
rm -f /tmp/validate_parsers_method.txt

echo "Verifying the fix worked..."
cd /app
if uv run python -c "import firecrawl; print('✅ Firecrawl imports successfully')" 2>/dev/null; then
    echo "✅ Firecrawl compatibility fix applied successfully"
else
    echo "❌ Fix failed, restoring backup"
    cd .venv/lib/python3.11/site-packages/firecrawl/v2
    cp types.py.backup types.py
    exit 1
fi