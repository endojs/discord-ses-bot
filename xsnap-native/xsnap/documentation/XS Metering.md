# XS Metering
Revised: June 14, 2021

Warning: These notes are preliminary. Omissions and errors are likely. If you encounter problems, please ask for assistance.

## Byte Codes

The objective is to allow runtime to constraint how much computation a machine can do.

The technique is to count how many byte codes are executed and to ask the runtime if the limit has been reached.

Asking the runtime at every byte code would be prohibitively slow. So XS only asks the runtime if the limit has been reached:

- when branching backwards,
- when calling a function,
- when returning from a function,
- when catching an exception,
- when iterating a generator,
- when resuming an async function.

To be faster, the runtime can also set a metering *interval*, a number of byte codes to wait for before asking again.

When the runtime tells XS that the limit has been reached, XS aborts with a "*too much computation*" exit. Like for other exits ("*not enough memory*", "*unhandled exception*", etc), the runtime can then decide what to do:

- throwing an exception,
- exiting the machine,
- exiting the process.

> Both exiting the machine and exiting the process cannot be caught by the executed JavaScript code.

## Built-ins

Most built-ins functions are implemented with macros similar to byte codes, which correspond roughly to the steps in the specifications. Such macros are metered too. 

For instance here is the path of the implementation of `Array.prototype.pop` which handles the case where `this` is not an `Array` instance.

		txNumber length = fxGetArrayLength(the, mxThis);
		if (length > 0) {
			length--;
			mxPushSlot(mxThis);
			mxPushNumber(length);
			mxGetAt();
			mxPullSlot(mxResult);
			mxPushSlot(mxThis);
			mxPushNumber(length);
			mxDeleteAt();
			mxPop();
		}
		mxPushNumber(length);
		mxPushSlot(mxThis);
		mxSetID(mxID(_length));
		mxPop();

All `mx*` macros increment the metering index.

Some built-ins functions have an optimized case where macros are not used. Then the metering index is explicitly incremented to match the non-optimized case. 

For instance here is the optimized path of `Array.prototype.pop` which handles the case where `this` is an `Array` instance.

		txIndex length = array->value.array.length;
		txSlot* address;
		mxMeterSome(2);
		if (length > 0) {
			length--;
			address = array->value.array.address + length;
			mxResult->kind = address->kind;
			mxResult->value = address->value;
			fxSetIndexSize(the, array, length);
			mxMeterSome(8);
		}
		mxMeterSome(4);

The `mxMeterSome` macro increment the metering index.

Metering built-ins is of course a *work in progress*. Future tests will require to tune such or such function.

## Regular Expressions

The execution of regular expressions also counts the steps defined by the pattern semantics. When the execution loops, XS asks the runtime if the limit has been reached.

That allows for instance to catch the infamous catastrophic backtracking. Here is an example from [regular-expressions.info](http://www.regular-expressions.info/catastrophic.html). 

The problematic regular expression increments the metering index to **96293**! 

	> xsnap -p -e 'print(/^(.*?,){11}P/.test("1,2,3,4,5,6,7,8,9,10,11,12,13"))'
	[96293] false

While the fixed regular expression only increments the metering index to **232**.
	
	> xsnap -p -e 'print(/^([^,\r\n]*,){11}P/.test("1,2,3,4,5,6,7,8,9,10,11,12,13"))'
	[232] false
	
## BigInt Operations

Numeric operations are only metered thru their byte codes. 

	> xsnap -p -e 'print(1_000_000_000 / 2)'
	[28] 500000000
	> xsnap -p -e 'print(5 ** 5)'
	[28] 3125
	
That is also the case of *small* BigInt values.

	> xsnap -p -e 'print(1_000_000_000n / 2n)'
	[28] 500000000
	> xsnap -p -e 'print(5n ** 5n)'
	[28] 3125
	
However, for *big* BigInt values, the cost of numeric operations increases with the size of the BigInt values. So the metering index increases too.

	> xsnap -p -e 'print(1_000_000_000_000_000_000_000_000_000n / 2n)'
	[30] 500000000000000000000000000
	> xsnap -p -e 'print(5n ** 5n ** 5n)'
	[256] 1911012597945477520356404559703964599198081048990094337139512789246520530242615803012059386519739850265586440155794462235359212788673806972288410146915986602087961896757195701839281660338047611225975533626101001482651123413147768252411493094447176965282756285196737514395357542479093219206641883011787169122552421070050709064674382870851449950256586194461543183511379849133691779928127433840431549236855526783596374102105331546031353725325748636909159778690328266459182983815230286936572873691422648131291743762136325730321645282979486862576245362218017673224940567642819360078720713837072355305446356153946401185348493792719514594505508232749221605848912910945189959948686199543147666938013037176163592594479746164220050885079469804487133205133160739134230540198872570038329801246050197013467397175909027389493923817315786996845899794781068042822436093783946335265422815704302832442385515082316490967285712171708123232790481817268327510112746782317410985888683708522000711733492253913322300756147180429007527677793352306200618286012455254243061006894805446584704820650982664319360960388736258510747074340636286976576702699258649953557976318173902550891331223294743930343956161328334072831663498258145226862004307799084688103804187368324800903873596212919633602583120781673673742533322879296907205490595621406888825991244581842379597863476484315673760923625090371511798941424262270220066286486867868710182980872802560693101949280830825044198424796792058908817112327192301455582916746795197430548026404646854002733993860798594465961501752586965811447568510041568687730903712482535343839285397598749458497050038225012489284001826590056251286187629938044407340142347062055785305325034918189589707199305662188512963187501743535960282201038211616048545121039313312256332260766436236688296850208839496142830484739113991669622649948563685234712873294796680884509405893951104650944137909502276545653133018670633521323028460519434381399810561400652595300731790772711065783494174642684720956134647327748584238274899668755052504394218232191357223054066715373374248543645663782045701654593218154053548393614250664498585403307466468541890148134347714650315037954175778622811776585876941680908203125

## Programming Interface

To begin metering use the `xsBeginMetering` macro:

	xsBeginMetering(xsMachine* machine,
					xsBooleanValue (*ask)(xsMachine* the, xsUnsignedValue index),
					xsUnsignedValue interval)

- `machine`: the machine to meter.
- `ask`: the C function that XS will call to ask if the limit has been reached.
- `interval`: the metering interval.

The macro uses `setjmp` and must be balanced with the `xsEndMetering` macro:

	xsEndMetering(xsMachine* machine)
	
- `machine`: the metered machine.

The `ask` callback gets the metered machine and the current index. It returns `1` to tell XS to continue, `0` to tell XS to abort.

## Usage

Here is the typical runtime sequence:

	static xsBooleanValue ask(xsMachine* machine, xsUnsignedValue index)
	{
		if (index > 10000) {
			fprintf(stderr, "too much computation\n");
			return 0;
		}
		return 1;
	}
	
	int main(int argc, char* argv[]) 
	{
		//...
		xsMachine* machine xsCreateMachine(creation, "main", NULL);
		xsBeginMetering(machine, ask, 1000);
		{
			xsBeginHost(machine);
			{
				// execute scripts or modules
			}
			xsEndHost(machine);
		}
		xsEndMetering(machine);
		xsDeleteMachine(machine);
		//...
	}

The fxAbort function has to be supplied by all runtimes based on XS. Here the `xsTooMuchComputationExit` case exits the machine.
	
	void fxAbort(xsMachine* the, int exit)
	{
		if (exit == xsTooMuchComputationExit) {
			fxExitToHost(the);
		}
		//...
	}

### In JavaScript

The runtime must provide a C function for the `ask` callback. However the `ask` callback can use the XS in C programming interface to call a JavaScript function. Like a system callback, the `ask` callback has to use `xsBeginHost` and `xsEndHost`.

	static xsBooleanValue ask(xsMachine* machine, xsUnsignedValue index)
	{
		xsBooleanValue result;
		xsBeginHost(machine);
		{
			result = xsToBoolean(xsCall1(xsGlobal, xsID_ask, xsNumber(index));
		}
		xsEndHost(machine);
		return result;
	}

The metering is suspended during the `ask` callback.

