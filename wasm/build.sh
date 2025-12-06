#!/bin/bash

# Build Rust WASM module

set -e

echo "🔨 Building WASM module..."
echo ""

# Build Rust
echo "🦀 Building Rust..."
cd rust
wasm-pack build --target nodejs --release
cd ..
echo "✅ Rust built"
echo ""

echo "✨ WASM module built successfully!"
