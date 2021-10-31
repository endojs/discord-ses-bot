"use strict";

lockdown();
const o = {
	foo:88,
};
print(purify(o));

const p = harden({
	foo:88,
});
print(purify(p));
