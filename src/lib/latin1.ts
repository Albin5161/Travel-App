// A phone's TextDecoder reads UTF-8 and nothing else. jsPDF's PNG reader asks for a Latin-1 one the
// moment it loads (for the notes a PNG can carry), and without it the whole library fails to load:
// "Unknown encoding: latin1". This adds that one encoding, where every byte is its own character.
// Import it before jsPDF. It does nothing where Latin-1 is already understood.

type Bytes = ArrayBuffer | ArrayBufferView;

class Latin1Decoder {
  readonly encoding = 'windows-1252';
  readonly fatal = false;
  readonly ignoreBOM = false;

  decode(input?: Bytes) {
    if (!input) return '';
    const bytes = ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : new Uint8Array(input);
    let text = '';
    for (let i = 0; i < bytes.length; i += 4096) text += String.fromCharCode(...bytes.subarray(i, i + 4096));
    return text;
  }
}

function understood() {
  try {
    new TextDecoder('latin1');
    return true;
  } catch {
    return false;
  }
}

if (!understood()) {
  const Utf8 = globalThis.TextDecoder;
  const Decoder = function (label = 'utf-8', options?: TextDecoderOptions) {
    return label.trim().toLowerCase() === 'latin1' ? new Latin1Decoder() : new Utf8(label, options);
  };
  Decoder.prototype = Utf8.prototype;
  globalThis.TextDecoder = Decoder as unknown as typeof TextDecoder;
}
