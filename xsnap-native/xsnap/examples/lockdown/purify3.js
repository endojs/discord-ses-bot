"use strict";

lockdown();

class C {
	#f
	constructor(f) {
		this.#f = f;
	}
}

const values = {
	c: new C(0),
	date: new Date('1993-3-28'),
	dataView: new DataView(new ArrayBuffer(10)),
	map: new Map([["a", 0],["b", 1],["c", 2],["d", 2]]),
	set: new Set([0, 1, 2, 3]),
	typedArray: new Uint8Array([0, 1, 2, 3]),
	weakMap: new WeakMap(),
	weakSet: new WeakSet(),
};
harden(values);
print(purify(values));
