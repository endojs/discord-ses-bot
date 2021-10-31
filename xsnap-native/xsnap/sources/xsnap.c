#include "xsnap.h"

#define SNAPSHOT_SIGNATURE "xsnap 1"

extern void fxDumpSnapshot(xsMachine* the, xsSnapshot* snapshot);

static void xsBuildAgent(xsMachine* the);
static void xsPrintUsage();
static void xsReplay(xsMachine* machine);

static void xs_clearTimer(xsMachine* the);
static void xs_currentMeterLimit(xsMachine* the);
static void xs_gc(xsMachine* the);
static void xs_issueCommand(xsMachine* the);
static void xs_performance_now(xsMachine* the);
static void xs_print(xsMachine* the);
static void xs_resetMeter(xsMachine* the);
static void xs_setImmediate(xsMachine* the);
static void xs_setInterval(xsMachine* the);
static void xs_setTimeout(xsMachine* the);

extern void xs_textdecoder(xsMachine *the);
extern void xs_textdecoder_decode(xsMachine *the);
extern void xs_textdecoder_get_encoding(xsMachine *the);
extern void xs_textdecoder_get_ignoreBOM(xsMachine *the);
extern void xs_textdecoder_get_fatal(xsMachine *the);

extern void xs_textencoder(xsMachine *the);
extern void xs_textencoder_encode(xsMachine *the);
extern void xs_textencoder_encodeInto(xsMachine *the);

extern void modInstallTextDecoder(xsMachine *the);
extern void modInstallTextEncoder(xsMachine *the);

extern void xs_base64_encode(xsMachine *the);
extern void xs_base64_decode(xsMachine *the);
extern void modInstallBase64(xsMachine *the);

#define mxSnapshotCallbackCount 23
xsCallback gxSnapshotCallbacks[mxSnapshotCallbackCount] = {
	xs_issueCommand, // 0
	xs_print, // 1
	xs_gc, // 2

	xs_clearTimer, // 3
	xs_setImmediate, // 4
	xs_setInterval, // 5
	xs_setTimeout, // 6

	xs_performance_now, // 7
	xs_currentMeterLimit, // 8
	xs_resetMeter, // 9

	xs_textdecoder, // 10
	xs_textdecoder_decode, // 11
	xs_textdecoder_get_encoding, // 12
	xs_textdecoder_get_ignoreBOM, // 13
	xs_textdecoder_get_fatal, // 14

	xs_textencoder, // 15
	xs_textencoder_encode, // 16
	xs_textencoder_encodeInto, // 17

	xs_base64_encode, // 18
	xs_base64_decode, // 19

	fx_lockdown, // 20
	fx_harden, // 21
	fx_purify, // 22
};

static int xsSnapshopRead(void* stream, void* address, size_t size)
{
	return (fread(address, size, 1, stream) == 1) ? 0 : errno;
}

static int xsSnapshopWrite(void* stream, void* address, size_t size)
{
	return (fwrite(address, size, 1, stream) == 1) ? 0 : errno;
}
	
static xsUnsignedValue gxCurrentMeter = 0;
static xsBooleanValue gxMeteringPrint = 0;
static xsUnsignedValue gxMeteringLimit = 0;
#ifdef mxMetering
static xsBooleanValue xsMeteringCallback(xsMachine* the, xsUnsignedValue index)
{
	if (index > gxMeteringLimit) {
// 		fprintf(stderr, "too much computation\n");
		return 0;
	}
// 	fprintf(stderr, "%d\n", index);
	return 1;
}
#endif

int main(int argc, char* argv[]) 
{
	int argi;
	int argd = 0;
	int argr = 0;
	int argw = 0;
	int error = 0;
	int interval = 0;
	int option = 0;
	xsCreation _creation = {
		16 * 1024 * 1024, 	/* initialChunkSize */
		4 * 1024 * 1024, 	/* incrementalChunkSize */
		1 * 1024 * 1024, 	/* initialHeapCount */
		1 * 1024 * 1024, 	/* incrementalHeapCount */
		4096, 				/* stackCount */
		256 * 1024, 		/* keyCount */
		1993, 				/* nameModulo */
		127, 				/* symbolModulo */
		256 * 1024,			/* parserBufferSize */
		1993,				/* parserTableModulo */
	};
	xsCreation* creation = &_creation;
	xsSnapshot snapshot = {
		SNAPSHOT_SIGNATURE,
		sizeof(SNAPSHOT_SIGNATURE) - 1,
		gxSnapshotCallbacks,
		mxSnapshotCallbackCount,
		xsSnapshopRead,
		xsSnapshopWrite,
		NULL,
		0,
		NULL,
		NULL,
		NULL,
	};
	xsMachine* machine;
	char path[C_PATH_MAX];
	char* dot;

	if (argc == 1) {
		xsPrintUsage();
		return 0;
	}
	for (argi = 1; argi < argc; argi++) {
		if (argv[argi][0] != '-')
			continue;
		if (!strcmp(argv[argi], "-d")) {
			argi++;
			if (argi < argc)
				argd = argi;
			else {
				xsPrintUsage();
				return 1;
			}
			option = 5;
		}
		else if (!strcmp(argv[argi], "-e"))
			option = 1;
		else if (!strcmp(argv[argi], "-h"))
			xsPrintUsage();
		else if (!strcmp(argv[argi], "-i")) {
			argi++;
			if (argi < argc)
				interval = atoi(argv[argi]);
			else {
				xsPrintUsage();
				return 1;
			}
		}
		else if (!strcmp(argv[argi], "-l")) {
			argi++;
			if (argi < argc)
				gxMeteringLimit = atoi(argv[argi]);
			else {
				xsPrintUsage();
				return 1;
			}
		}
		else if (!strcmp(argv[argi], "-m"))
			option = 2;
		else if (!strcmp(argv[argi], "-p"))
			gxMeteringPrint = 1;
		else if (!strcmp(argv[argi], "-r")) {
			argi++;
			if (argi < argc)
				argr = argi;
			else {
				xsPrintUsage();
				return 1;
			}
		}
		else if (!strcmp(argv[argi], "-s"))
			option = 3;
		else if (!strcmp(argv[argi], "-t"))
			option = 4;
		else if (!strcmp(argv[argi], "-v")) {
			xsVersion(path, sizeof(path));
			printf("XS %s\n", path);
		}
		else if (!strcmp(argv[argi], "-w")) {
			argi++;
			if (argi < argc)
				argw = argi;
			else {
				xsPrintUsage();
				return 1;
			}
		}
		else {
			xsPrintUsage();
			return 1;
		}
	}
	if (gxMeteringLimit) {
		if (interval == 0)
			interval = 1;
	}
	xsInitializeSharedCluster();
	if (argr) {
		snapshot.stream = fopen(argv[argr], "rb");
		if (snapshot.stream) {
			machine = xsReadSnapshot(&snapshot, "xsnap", NULL);
			fclose(snapshot.stream);
		}
		else
			snapshot.error = errno;
		if (snapshot.error) {
			fprintf(stderr, "cannot read snapshot %s: %s\n", argv[argr], strerror(snapshot.error));
			return 1;
		}
	}
	else {
		machine = xsCreateMachine(creation, "xsnap", NULL);
		xsBuildAgent(machine);
	}
	xsBeginMetering(machine, xsMeteringCallback, interval);
	{
		if (option == 5) {
			snapshot.stream = fopen(argv[argd], "rb");
			if (snapshot.stream) {
				fxDumpSnapshot(machine, &snapshot);
				fclose(snapshot.stream);
			}
			else
				snapshot.error = errno;
			if (snapshot.error) {
				fprintf(stderr, "cannot dump snapshot %s: %s\n", argv[argr], strerror(snapshot.error));
				return 1;
			}
		}
		else if (option == 4) {
			xsReplay(machine);
		}
		else {
			xsBeginHost(machine);
			{
				xsVars(1);
				for (argi = 1; argi < argc; argi++) {
					if (!strcmp(argv[argi], "-i")) {
						argi++;
						continue;
					}
					if (!strcmp(argv[argi], "-l")) {
						argi++;
						continue;
					}
					if (argv[argi][0] == '-')
						continue;
					if (argi == argr)
						continue;
					if (argi == argw)
						continue;
					if (option == 1) {
						xsResult = xsString(argv[argi]);
						xsCall1(xsGlobal, xsID("eval"), xsResult);
					}
					else {	
						if (!c_realpath(argv[argi], path))
							xsURIError("file not found: %s", argv[argi]);
						dot = strrchr(path, '.');
						if (((option == 0) && dot && !c_strcmp(dot, ".mjs")) || (option == 2))
							xsRunModuleFile(path);
						else
							xsRunProgramFile(path);
					}
				}
			}
			xsEndHost(machine);
			xsRunLoop(machine);
			if (argw) {
				snapshot.stream = fopen(argv[argw], "wb");
				if (snapshot.stream) {
					xsWriteSnapshot(machine, &snapshot);
					fclose(snapshot.stream);
				}
				else
					snapshot.error = errno;
				if (snapshot.error) {
					fprintf(stderr, "cannot write snapshot %s: %s\n", argv[argw], strerror(snapshot.error));
				}
			}
		}
	}
	xsEndMetering(machine);
	if (machine->abortStatus)
		error = machine->abortStatus;
	xsDeleteMachine(machine);
	xsTerminateSharedCluster();
	return error;
}

void xsBuildAgent(xsMachine* machine) 
{
	xsBeginHost(machine);
	xsVars(1);
	
	xsResult = xsNewHostFunction(xs_clearTimer, 1);
	xsDefine(xsGlobal, xsID("clearImmediate"), xsResult, xsDontEnum);
	xsResult = xsNewHostFunction(xs_setImmediate, 1);
	xsDefine(xsGlobal, xsID("setImmediate"), xsResult, xsDontEnum);
	
	xsResult = xsNewHostFunction(xs_clearTimer, 1);
	xsDefine(xsGlobal, xsID("clearInterval"), xsResult, xsDontEnum);
	xsResult = xsNewHostFunction(xs_setInterval, 1);
	xsDefine(xsGlobal, xsID("setInterval"), xsResult, xsDontEnum);
	
	xsResult = xsNewHostFunction(xs_clearTimer, 1);
	xsDefine(xsGlobal, xsID("clearTimeout"), xsResult, xsDontEnum);
	xsResult = xsNewHostFunction(xs_setTimeout, 1);
	xsDefine(xsGlobal, xsID("setTimeout"), xsResult, xsDontEnum);
	
	xsResult = xsNewHostFunction(xs_gc, 1);
	xsDefine(xsGlobal, xsID("gc"), xsResult, xsDontEnum);
	xsResult = xsNewHostFunction(xs_print, 1);
	xsDefine(xsGlobal, xsID("print"), xsResult, xsDontEnum);
	
	xsResult = xsNewHostFunction(xs_issueCommand, 1);
	xsDefine(xsGlobal, xsID("issueCommand"), xsResult, xsDontEnum);
	
	xsResult = xsNewObject();
	xsVar(0) = xsNewHostFunction(xs_performance_now, 0);
	xsDefine(xsResult, xsID("now"), xsVar(0), xsDontEnum);
	xsDefine(xsGlobal, xsID("performance"), xsResult, xsDontEnum);
	
	xsResult = xsNewHostFunction(xs_currentMeterLimit, 1);
	xsDefine(xsGlobal, xsID("currentMeterLimit"), xsResult, xsDontEnum);
	xsResult = xsNewHostFunction(xs_resetMeter, 1);
	xsDefine(xsGlobal, xsID("resetMeter"), xsResult, xsDontEnum);

	modInstallTextDecoder(the);
	modInstallTextEncoder(the);
	modInstallBase64(the);

	xsResult = xsNewHostFunction(fx_harden, 1);
	xsDefine(xsGlobal, xsID("harden"), xsResult, xsDontEnum);
	xsResult = xsNewHostFunction(fx_lockdown, 0);
	xsDefine(xsGlobal, xsID("lockdown"), xsResult, xsDontEnum);
	xsResult = xsNewHostFunction(fx_purify, 1);
	xsDefine(xsGlobal, xsID("purify"), xsResult, xsDontEnum);

	xsEndHost(machine);
}

void xsPrintUsage()
{
	printf("xsnap [-h] [-e] [i <interval] [l <limit] [-m] [-r <snapshot>] [-s] [-v] [-w <snapshot>] strings...\n");
	printf("\t-e: eval strings\n");
	printf("\t-h: print this help message\n");
	printf("\t-i <interval>: metering interval (default to 1)\n");
	printf("\t-l <limit>: metering limit (default to none)\n");
	printf("\t-m: strings are paths to modules\n");
	printf("\t-r <snapshot>: read snapshot to create the XS machine\n");
	printf("\t-s: strings are paths to scripts\n");
	printf("\t-v: print XS version\n");
	printf("\t-w <snapshot>: write snapshot of the XS machine at exit\n");
	printf("without -e, -m, -s:\n");
	printf("\tif the extension is .mjs, strings are paths to modules\n");
	printf("\telse strings are paths to scripts\n");
}

static int gxStep = 0;

void xsReplay(xsMachine* machine)
{
	char path[C_PATH_MAX];
	char* names[5] = { "-evaluate.dat", "-issueCommand.dat", "-command.dat", "-reply.dat", "-options.json", };
	for (;;) {
		int which;
		xsBeginHost(machine);
		for (which = 0; which < 5; which++) {
			sprintf(path, "%05d%s", gxStep, names[which]);
			{
			#if mxWindows
				DWORD attributes = GetFileAttributes(path);
				if ((attributes != 0xFFFFFFFF) && (!(attributes & FILE_ATTRIBUTE_DIRECTORY)))
			#else
				struct stat a_stat;
				if ((stat(path, &a_stat) == 0) && (S_ISREG(a_stat.st_mode)))
			#endif
				{
					fprintf(stderr, "### %s\n", path);
					FILE* file = fopen(path, "rb");
					if (file) {
						size_t length;
						fseek(file, 0, SEEK_END);
						length = ftell(file);
						fseek(file, 0, SEEK_SET);
						if (which == 0) {
							xsStringValue string;
							xsResult = xsStringBuffer(NULL, (xsIntegerValue)length);
							string = xsToString(xsResult);
							length = fread(string, 1, length, file);
							string[length] = 0;
							fclose(file);
							xsCall1(xsGlobal, xsID("eval"), xsResult);

						}
						else if (which == 1) {
							xsResult = xsArrayBuffer(NULL, (xsIntegerValue)length);
							length = fread(xsToArrayBuffer(xsResult), 1, length, file);	
							fclose(file);
							xsCall1(xsGlobal, xsID("handleCommand"), xsResult);

						}
					}
					break;
				}
			}
		}
		xsEndHost(machine);
		if (which == 5)
			break;
		gxStep++;
		fxRunLoop(machine);
	}
}

void xs_currentMeterLimit(xsMachine* the)
{
#if mxMetering
	xsResult = xsInteger(gxCurrentMeter);
#endif
}

void xs_gc(xsMachine* the)
{
	xsCollectGarbage();
}

void xs_issueCommand(xsMachine* the)
{
	char path[C_PATH_MAX];
	FILE* file;
	size_t length;
	sprintf(path, "%05d-command.dat", gxStep);
	fprintf(stderr, "### %s\n", path);
	gxStep++;
	sprintf(path, "%05d-reply.dat", gxStep);
	fprintf(stderr, "### %s\n", path);
	gxStep++;
	file = fopen(path, "rb");
	if (!file) xsUnknownError("cannot open %s", path);
	fseek(file, 0, SEEK_END);
	length = ftell(file);
	fseek(file, 0, SEEK_SET);
	xsResult = xsArrayBuffer(NULL, (xsIntegerValue)length);
	length = fread(xsToArrayBuffer(xsResult), 1, length, file);
	fclose(file);
}

void xs_performance_now(xsMachine *the)
{
	c_timeval tv;
	c_gettimeofday(&tv, NULL);
	xsResult = xsNumber((double)(tv.tv_sec * 1000.0) + ((double)(tv.tv_usec) / 1000.0));
}

void xs_print(xsMachine* the)
{
	xsIntegerValue c = xsToInteger(xsArgc), i;
	for (i = 0; i < c; i++) {
		xsToString(xsArg(i));
	}
#ifdef mxMetering
	if (gxMeteringPrint)
		fprintf(stdout, "[%u] ", xsGetCurrentMeter(the));
#endif
	for (i = 0; i < c; i++) {
		if (i)
			fprintf(stdout, " ");
		fprintf(stdout, "%s", xsToString(xsArg(i)));
	}
	fprintf(stdout, "\n");
}

void xs_resetMeter(xsMachine* the)
{
#if mxMetering
	xsIntegerValue argc = xsToInteger(xsArgc);
	if (argc < 2) {
		xsTypeError("expected newMeterLimit, newMeterIndex");
	}
	xsResult = xsInteger(xsGetCurrentMeter(the));
	gxCurrentMeter = xsToInteger(xsArg(0));
	xsSetCurrentMeter(the, xsToInteger(xsArg(1)));
#endif
}

void xs_setImmediate(xsMachine* the)
{
	xsSetTimer(0, 0);
}

void xs_setInterval(xsMachine* the)
{
	xsSetTimer(xsToNumber(xsArg(1)), 1);
}

void xs_setTimeout(xsMachine* the)
{
	xsSetTimer(xsToNumber(xsArg(1)), 0);
}

void xs_clearTimer(xsMachine* the)
{
	xsClearTimer();
}





