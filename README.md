emcc -O3 -s WASM=1 -s EXTRA_EXPORTED_RUNTIME_METHODS='["cwrap", "getValue"]' -s ALLOW_MEMORY_GROWTH=1 -I libwebp webp.c libwebp/src/{dec,dsp,demux,enc,mux,utils}/*.c -s EXPORTED_FUNCTIONS="['_malloc', '_free']" -o public/libwebp/libwebp_wasm.js

