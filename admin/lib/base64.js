// UTF-8 safe base64 for the GitHub blob/contents API.
//
// Direct `btoa(str)` fails on multibyte characters and can blow the
// call stack on large inputs. The chunked fromCharCode trick keeps
// things safe for payloads in the tens of MB.

const CHUNK_SIZE = 0x8000; // 32 KB — avoids "Maximum call stack size exceeded"

export function encode(str) {
  const bytes = new TextEncoder().encode(str);
  return bytesToBase64(bytes);
}

export function decode(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Blob / File → base64 (async). Useful for uploading images from a
// file input.
export async function fileToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}
