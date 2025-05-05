#!/bin/bash
# Script to build and run the application in production mode

echo "Building application for production..."
npm run build

if [ $? -eq 0 ]; then
  echo "Build successful! Starting application in production mode..."
  NODE_ENV=production node dist/index.js
else
  echo "Build failed. Please check the error messages above."
  exit 1
fi