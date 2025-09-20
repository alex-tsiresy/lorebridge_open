#!/usr/bin/env python3
"""
Simple script to serve API documentation using Swagger UI.
Requires: pip install flask-swagger-ui
"""

import os
from flask import Flask
from flask_swagger_ui import get_swaggerui_blueprint

app = Flask(__name__)

# Swagger UI configuration
SWAGGER_URL = '/docs'  # URL for exposing Swagger UI (without trailing '/')
API_URL = '/static/openapi.yml'  # Our API url (can be an external URL)

# Create swagger UI blueprint
swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,  # Swagger UI static files will be mapped to '{SWAGGER_URL}/dist/'
    API_URL,
    config={  # Swagger UI config overrides
        'app_name': "Enhanced Transcript Service API Documentation"
    }
)

app.register_blueprint(swaggerui_blueprint)

# Serve the OpenAPI spec file
@app.route('/static/openapi.yml')
def serve_openapi():
    """Serve the OpenAPI specification file"""
    with open('openapi.yml', 'r') as f:
        return f.read(), 200, {'Content-Type': 'text/yaml'}

@app.route('/')
def index():
    """Redirect to documentation"""
    return f'''
    <html>
    <head>
        <title>Enhanced Transcript Service</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            .container {{ max-width: 800px; margin: 0 auto; }}
            .button {{ 
                display: inline-block; 
                padding: 10px 20px; 
                background-color: #007bff; 
                color: white; 
                text-decoration: none; 
                border-radius: 5px; 
                margin: 10px 0;
            }}
            .button:hover {{ background-color: #0056b3; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Enhanced Transcript Service</h1>
            <p>Welcome to the Enhanced Transcript Service API documentation.</p>
            
            <h2>Documentation</h2>
            <a href="{SWAGGER_URL}" class="button">📚 Interactive API Documentation (Swagger UI)</a>
            
            <h2>Quick Links</h2>
            <ul>
                <li><a href="/static/openapi.yml">OpenAPI Specification (YAML)</a></li>
                <li><a href="./API_DOCUMENTATION.md">Detailed API Documentation</a></li>
                <li><a href="./README.md">Setup Guide</a></li>
            </ul>
            
            <h2>Service Status</h2>
            <p>Check if the main service is running:</p>
            <a href="http://localhost:5001/health" class="button">🔍 Health Check</a>
        </div>
    </body>
    </html>
    '''

if __name__ == '__main__':
    try:
        print("🚀 Starting API Documentation Server...")
        print(f"📚 Swagger UI available at: http://localhost:8080{SWAGGER_URL}")
        print(f"🏠 Home page at: http://localhost:8080/")
        print("📄 Make sure your main service is running on port 5001 for testing")
        print("\n" + "="*60)
        
        app.run(host='0.0.0.0', port=8080, debug=True)
    except ImportError:
        print("❌ flask-swagger-ui not installed!")
        print("📦 Install it with: pip install flask-swagger-ui")
        print("🔧 Or add it to requirements.txt")
    except Exception as e:
        print(f"❌ Error starting documentation server: {e}") 