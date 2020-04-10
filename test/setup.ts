import { TextEncoder, TextDecoder } from "util";
Reflect.set(globalThis, "TextEncoder", TextEncoder);
Reflect.set(globalThis, "TextDecoder", TextDecoder);
