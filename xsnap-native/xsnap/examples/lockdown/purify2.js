"use strict";

lockdown();

let v = 0;
const o = {
	oops(i) {
		return v + i;
	},
};
harden(o);
print(purify(o));

const c = 0;
const p = {
	oops(i) {
		return c + i;
	},
};
harden(p);
print(purify(p));
