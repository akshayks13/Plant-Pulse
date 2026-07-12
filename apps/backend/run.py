#!/usr/bin/env python3
"""
Start the Xylem backend server.
Usage: python run.py [--port 8000] [--reload]
"""
import sys
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
