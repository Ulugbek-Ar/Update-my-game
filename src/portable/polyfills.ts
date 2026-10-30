/**
 * Eski brauzerlar (Chrome 80 / Firefox 78) uchun kichik polifillar — bundle'da ishlatilgan,
 * lekin u brauzerlarda hali bo'lmagan metodlar. Sintaksis build target bilan pasaytiriladi.
 */
type AnyArr = { length: number; [i: number]: unknown };

function at(this: AnyArr, i: number) {
  const n = Math.trunc(i) || 0;
  const k = n < 0 ? this.length + n : n;
  return k < 0 || k >= this.length ? undefined : this[k];
}

function def(o: object, name: string, fn: unknown) {
  if (!(name in o))
    Object.defineProperty(o, name, { value: fn, writable: true, configurable: true });
}

def(Array.prototype, "at", at);
def(String.prototype, "at", at);
def(Array.prototype, "findLast", function (this: AnyArr, f: (v: unknown, i: number) => boolean) {
  for (let i = this.length - 1; i >= 0; i--) if (f(this[i], i)) return this[i];
  return undefined;
});
def(
  Array.prototype,
  "findLastIndex",
  function (this: AnyArr, f: (v: unknown, i: number) => boolean) {
    for (let i = this.length - 1; i >= 0; i--) if (f(this[i], i)) return i;
    return -1;
  },
);
def(String.prototype, "replaceAll", function (this: string, a: string | RegExp, b: string) {
  if (a instanceof RegExp) return this.replace(a, b);
  return this.split(a).join(b);
});
def(Object, "hasOwn", (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k));
def(globalThis, "structuredClone", (v: unknown) =>
  v === undefined ? v : JSON.parse(JSON.stringify(v)),
);
