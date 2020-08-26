import React from 'react';

function importClassicScript(src){
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    document.body.appendChild(script);

    return new Promise(resolve => script.onload = resolve);
}

let canvas = null;

function createPng(width, height, result) {
    canvas = canvas || document.createElement('canvas');

    return new Promise(resolve => {
        const img = new ImageData(result, width, height);

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(img, 0, 0);

        canvas.toBlob(blob => { resolve(blob); }, 'image/png', 1);
    });
}

class WebpDecoder extends React.Component {
    async componentDidMount() {
        console.log('wasm start init');
        await importClassicScript('libwebp/libwebp_wasm.js');
        window.Module.onRuntimeInitialized = () => {
            console.log('wasm finish init');
        };

        console.log('worker start init');
        this.worker = new Worker('libwebp/libwebp_wasm.worker.js');
    }

    decodeWebp = blob => {
        const { Module } = window;

        return new Promise(resolve => {
            const reader = new FileReader();

            reader.addEventListener('loadend', function() {
                console.log('start');
                const buffer = reader.result;

                const size = buffer.byteLength;
                const thisPtr = Module._malloc(size);
                Module.HEAPU8.set(new Uint8Array(buffer), thisPtr);

                const getInfo = window.Module.cwrap('getInfo', 'number', ['number', 'number']);

                const ptr = getInfo(thisPtr, size);
                const success = !!Module.getValue(ptr, "i32");
                if (!success) {
                    Module._free(ptr);
                    Module._free(thisPtr);
                    resolve({ width: 0, height: 0, result: null });
                }
                const width = Module.getValue(ptr + 4, "i32");
                const height = Module.getValue(ptr + 8, "i32");

                Module._free(ptr);

                console.log('getInfo');

                const decode = window.Module.cwrap('decode', 'number', ['number', 'number']);

                const resultPtr = decode(thisPtr, size);
                const resultView = new Uint8Array(Module.HEAPU8.buffer, resultPtr, width * height * 4);
                const result = new Uint8ClampedArray(resultView);
                Module._free(resultPtr);
                Module._free(thisPtr);

                console.log('decode', [width, height]);
                resolve({ width, height, result });
            });

            reader.readAsArrayBuffer(blob);
        });
    };

    onDecodeWebpW = event => {
        const { worker } = this;

        const { id } = event.data;
        if (worker.requests.has(id)) {
            const resolve = worker.requests.get(id);

            worker.requests.delete(id);
            resolve(event.data);
        }
    };

    decodeWebpW = blob => {
        const { worker } = this;

        return new Promise(resolve => {
            const id = Math.random();

            worker.onmessage = worker.onmessage || this.onDecodeWebpW;
            worker.requests = worker.requests || new Map();
            worker.requests.set(id, resolve);
            worker.postMessage({ id, blob });
        });
    };

    decodeFile = async (fileName, worker = true) => {
        const response = await fetch(fileName);
        const webp = await response.blob();

        const { result, width, height } = worker
            ? await this.decodeWebpW(webp) :
            await this.decodeWebp(webp);

        const blob = await createPng(width, height, result);
        const img = document.getElementById('image');
        img.src = URL.createObjectURL(blob);
    };

    render() {
        return (
            <div>
                <img id='image'/>
                <button onClick={() => this.decodeFile('test1.webp')}>decode (worker thread)</button>
                <button onClick={() => this.decodeFile('test2.webp', false)}>decode (UI thread)</button>
            </div>);
    }
}

WebpDecoder.propTypes = {};

export default WebpDecoder;