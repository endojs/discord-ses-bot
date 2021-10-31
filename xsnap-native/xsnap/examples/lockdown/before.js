"use strict";

const p = {
	test: "shared"
};
const o = Object.create(p);
o.test = "override";

try {
	harden(o);
}
catch(e) {
	print(e);
}

lockdown();
harden(o);

try {
	p.test = "oops";
}
catch(e) {
	print(e);
}

try {
	o.test = "oops";
}
catch(e) {
	print(e);
}
