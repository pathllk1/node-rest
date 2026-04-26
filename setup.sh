#!/bin/bash

echo "========================================="
echo "  SecureApp - Setup Script"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "  ✅ Setup Complete!"
    echo "========================================="
    echo ""
    echo "To start the application:"
    echo "  npm start"
    echo ""
    echo "Then open your browser to:"
    echo "  http://localhost:3000"
    echo ""
    echo "Demo Credentials:"
    echo "  Username: admin | Password: admin123"
    echo "  Username: user  | Password: user123"
    echo "  Username: demo  | Password: demo123"
    echo ""
    echo "========================================="
else
    echo ""
    echo "❌ Installation failed. Please check the error messages above."
    exit 1
fi
