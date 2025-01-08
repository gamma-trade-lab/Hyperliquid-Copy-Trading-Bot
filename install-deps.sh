#!/bin/bash

# Install TypeScript and related dependencies
npm install -g typescript ts-node

# Install database dependencies
npm install typeorm @types/node dotenv mongoose redis pg @prisma/client

# Install TypeScript type definitions
npm install -D @types/node @types/dotenv tslib

# Install development dependencies
npm install -D typescript ts-node nodemon @types/jest jest ts-jest

# Install additional utilities
npm install winston uuid 