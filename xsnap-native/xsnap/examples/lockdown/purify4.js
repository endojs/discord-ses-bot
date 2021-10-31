lockdown();
const c = {};
const p = {
	oops(i) {
		return c + i;
	},
};
harden(p);
print(purify(p));
