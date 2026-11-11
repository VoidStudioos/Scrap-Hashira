import 'fake-indexeddb/auto';

// jsdom's Blob lacks browser Blob.text/arrayBuffer; supply the browser-compatible methods.
if (!Blob.prototype.text)
  Object.defineProperty(Blob.prototype, 'text', {
    configurable: true,
    value: function (this: Blob) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    },
  });
if (!Blob.prototype.arrayBuffer)
  Object.defineProperty(Blob.prototype, 'arrayBuffer', {
    configurable: true,
    value: function (this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    },
  });
