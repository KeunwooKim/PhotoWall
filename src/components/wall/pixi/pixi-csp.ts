/**
 * Must load before any pixi.js Application / renderer use.
 * CSP script-src omits 'unsafe-eval'; this polyfill avoids new Function() for shaders.
 * @see https://pixijs.download/release/docs/extensions_unsafe-eval_init.html
 */
import "pixi.js/unsafe-eval";
