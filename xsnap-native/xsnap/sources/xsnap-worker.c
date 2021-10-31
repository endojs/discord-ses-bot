#include "xsnap.h"

#define SNAPSHOT_SIGNATURE "xsnap 1"
#ifndef XSNAP_VERSION
# error "You must define XSNAP_VERSION in the right Makefile"
#endif

#ifndef XSNAP_TEST_RECORD
#define XSNAP_TEST_RECORD 1
#endif

#if XSNAP_TEST_RECORD
enum {
	mxTestRecordJS = 1,
	mxTestRecordJSON = 2,
	mxTestRecordParam = 4,
	mxTestRecordReply = 8,
};
int gxTestRecordParamIndex = 0;
int gxTestRecordReplyIndex = 0;
static void fxTestRecordArgs(int argc, char* argv[]);
static void fxTestRecord(int flags, void* buffer, size_t length);
#endif

static void xsBuildAgent(xsMachine* the);
static void xsPrintUsage();

// static void xs_clearTimer(xsMachine* the);
static void xs_currentMeterLimit(xsMachine* the);
static void xs_gc(xsMachine* the);
static void xs_issueCommand(xsMachine* the);
static void xs_performance_now(xsMachine* the);
static void xs_print(xsMachine* the);
static void xs_resetMeter(xsMachine* the);
static void xs_setImmediate(xsMachine* the);
// static void xs_setInterval(xsMachine* the);
// static void xs_setTimeout(xsMachine* the);

static int fxReadNetString(FILE *inStream, char** dest, size_t* len);
static char* fxReadNetStringError(int code);
static int fxWriteOkay(FILE* outStream, xsUnsignedValue meterIndex, xsMachine *the, char* buf, size_t len);
static int fxWriteNetString(FILE* outStream, char* prefix, char* buf, size_t len);
static char* fxWriteNetStringError(int code);

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

// The order of the callbacks materially affects how they are introduced to
// code that runs from a snapshot, so must be consistent in the face of
// upgrade.
#define mxSnapshotCallbackCount 17
xsCallback gxSnapshotCallbacks[mxSnapshotCallbackCount] = {
	xs_issueCommand, // 0
	xs_print, // 1
	xs_setImmediate, // 2
	xs_gc, // 3
	xs_performance_now, // 4
	xs_currentMeterLimit, // 5
	xs_resetMeter, // 6

	xs_textdecoder, // 7
	xs_textdecoder_decode, // 8
	xs_textdecoder_get_encoding, // 9
	xs_textdecoder_get_ignoreBOM, // 10
	xs_textdecoder_get_fatal, // 11

	xs_textencoder, // 12
	xs_textencoder_encode, // 13
	xs_textencoder_encodeInto, // 14

	xs_base64_encode, // 15
	xs_base64_decode, // 16

	// fx_setInterval,
	// fx_setTimeout,
	// fx_clearTimer,
};

static int fxSnapshotRead(void* stream, void* address, size_t size)
{
	return (fread(address, size, 1, stream) == 1) ? 0 : errno;
}

static int fxSnapshotWrite(void* stream, void* address, size_t size)
{
	return (fwrite(address, size, 1, stream) == 1) ? 0 : errno;
}

#if mxMetering
#define xsBeginCrank(_THE, _LIMIT) \
	(xsSetCurrentMeter(_THE, 0), \
	gxCurrentMeter = _LIMIT)
#define xsEndCrank(_THE) \
	(gxCurrentMeter = 0, \
	fxGetCurrentMeter(_THE))
#else
	#define xsBeginCrank(_THE, _LIMIT)
	#define xsEndCrank(_THE) 0
#endif

static xsUnsignedValue gxCrankMeteringLimit = 0;
static xsUnsignedValue gxCurrentMeter = 0;
xsBooleanValue fxMeteringCallback(xsMachine* the, xsUnsignedValue index)
{
	if (gxCurrentMeter > 0 && index > gxCurrentMeter) {
		// Just throw right out of the main loop and exit.
		return 0;
	}
	// fprintf(stderr, "metering up to %d\n", index);
	return 1;
}
static xsBooleanValue gxMeteringPrint = 0;

static FILE *fromParent;
static FILE *toParent;

typedef enum {
	E_UNKNOWN_ERROR = -1,
	E_SUCCESS = 0,
	E_BAD_USAGE,
	E_IO_ERROR,
	// 10 + XS_NOT_ENOUGH_MEMORY_EXIT
	E_NOT_ENOUGH_MEMORY = 11,
	E_STACK_OVERFLOW = 12,
	E_UNHANDLED_EXCEPTION = 15,
	E_NO_MORE_KEYS = 16,
	E_TOO_MUCH_COMPUTATION = 17,
} ExitCode;

int main(int argc, char* argv[])
{
	int argi;
	int argr = 0;
	int error = 0;
	int interval = 0;
	int parserBufferSize = 8192 * 1024;

	xsSnapshot snapshot = {
		SNAPSHOT_SIGNATURE,
		sizeof(SNAPSHOT_SIGNATURE) - 1,
		gxSnapshotCallbacks,
		mxSnapshotCallbackCount,
		fxSnapshotRead,
		fxSnapshotWrite,
		NULL,
		0,
		NULL,
		NULL,
		NULL,
	};

	xsMachine* machine;
	char *path;

#if XSNAP_TEST_RECORD
	fxTestRecordArgs(argc, argv);
#endif

	for (argi = 1; argi < argc; argi++) {
		if (argv[argi][0] != '-')
			continue;
		if (!strcmp(argv[argi], "-h")) {
			xsPrintUsage();
			return 0;
		} else if (!strcmp(argv[argi], "-i")) {
			argi++;
			if (argi < argc)
				interval = atoi(argv[argi]);
			else {
				xsPrintUsage();
				return E_BAD_USAGE;
			}
		}
		else if (!strcmp(argv[argi], "-l")) {
#if mxMetering
			argi++;
			if (argi < argc)
				gxCrankMeteringLimit = atoi(argv[argi]);
			else {
				xsPrintUsage();
				return E_BAD_USAGE;
			}
#else
			fprintf(stderr, "%s flag not implemented; mxMetering is not enabled\n", argv[argi]);
			return E_BAD_USAGE;
#endif
		}
		else if (!strcmp(argv[argi], "-p"))
			gxMeteringPrint = 1;
		else if (!strcmp(argv[argi], "-r")) {
			argi++;
			if (argi < argc)
				argr = argi;
			else {
				xsPrintUsage();
				return E_BAD_USAGE;
			}
		}
		else if (!strcmp(argv[argi], "-s")) {
			argi++;
			if (argi < argc)
				parserBufferSize = 1024 * atoi(argv[argi]);
			else {
				xsPrintUsage();
				return E_BAD_USAGE;
			}
		}
		else if (!strcmp(argv[argi], "-v")) {
			char version[16];
			xsVersion(version, sizeof(version));
			printf("xsnap %s (XS %s)\n", XSNAP_VERSION, version);
			return E_SUCCESS;
		} else {
			xsPrintUsage();
			return E_BAD_USAGE;
		}
	}
	xsCreation _creation = {
		32 * 1024 * 1024,	/* initialChunkSize */
		4 * 1024 * 1024,	/* incrementalChunkSize */
		256 * 1024,			/* initialHeapCount */
		128 * 1024,			/* incrementalHeapCount */
		4096,				/* stackCount */
		32000,				/* keyCount */
		1993,				/* nameModulo */
		127,				/* symbolModulo */
		parserBufferSize,	/* parserBufferSize */
		1993,				/* parserTableModulo */
	};
	xsCreation* creation = &_creation;

	if (gxCrankMeteringLimit) {
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
			return E_IO_ERROR;
		}
	}
	else {
		machine = xsCreateMachine(creation, "xsnap", NULL);
		xsBuildAgent(machine);
	}
	if (!(fromParent = fdopen(3, "rb"))) {
		fprintf(stderr, "fdopen(3) from parent failed\n");
		c_exit(E_IO_ERROR);
	}
	if (!(toParent = fdopen(4, "wb"))) {
		fprintf(stderr, "fdopen(4) to parent failed\n");
		c_exit(E_IO_ERROR);
	}
	xsBeginMetering(machine, fxMeteringCallback, interval);
	{
		char done = 0;
		while (!done) {
			// By default, use the infinite meter.
			gxCurrentMeter = 0;

			xsUnsignedValue meterIndex = 0;
			char* nsbuf;
			size_t nslen;
			int readError = fxReadNetString(fromParent, &nsbuf, &nslen);
			int writeError = 0;

			if (readError != 0) {
				if (feof(fromParent)) {
					break;
				} else {
					fprintf(stderr, "%s\n", fxReadNetStringError(readError));
					c_exit(E_IO_ERROR);
				}
			}
			char command = *nsbuf;
			// fprintf(stderr, "command: len %d %c arg: %s\n", nslen, command, nsbuf + 1);
			switch(command) {
			case 'R': // isReady
				fxWriteNetString(toParent, ".", "", 0);
				break;
			case '?':
			case 'e':
				xsBeginCrank(machine, gxCrankMeteringLimit);
				error = 0;
				xsBeginHost(machine);
				{
					xsVars(3);
					xsTry {
						if (command == '?') {
							#if XSNAP_TEST_RECORD
								fxTestRecord(mxTestRecordJSON | mxTestRecordParam, nsbuf + 1, nslen - 1);
							#endif
							xsVar(0) = xsArrayBuffer(nsbuf + 1, nslen - 1);
							xsVar(1) = xsCall1(xsGlobal, xsID("handleCommand"), xsVar(0));
						} else {
							#if XSNAP_TEST_RECORD
								fxTestRecord(mxTestRecordJS | mxTestRecordParam, nsbuf + 1, nslen - 1);
							#endif
							xsVar(0) = xsStringBuffer(nsbuf + 1, nslen - 1);
							xsVar(1) = xsCall1(xsGlobal, xsID("eval"), xsVar(0));
						}
					}
					xsCatch {
						if (xsTypeOf(xsException) != xsUndefinedType) {
							// fprintf(stderr, "%c: %s\n", command, xsToString(xsException));
							error = E_UNHANDLED_EXCEPTION;
							xsVar(1) = xsException;
							xsException = xsUndefined;
						}
					}
				}
				fxRunLoop(machine);
				meterIndex = xsEndCrank(machine);
				{
					if (error) {
						xsStringValue message = xsToString(xsVar(1));
						writeError = fxWriteNetString(toParent, "!", message, strlen(message));
						// fprintf(stderr, "error: %d, writeError: %d %s\n", error, writeError, message);
					} else {
						char* response = NULL;
						xsIntegerValue responseLength = 0;
						// fprintf(stderr, "report: %d %s\n", xsTypeOf(report), xsToString(report));
						xsTry {
							if (xsTypeOf(xsVar(1)) == xsReferenceType && xsHas(xsVar(1), xsID("result"))) {
								xsVar(2) = xsGet(xsVar(1), xsID("result"));
							} else {
								xsVar(2) = xsVar(1);
							}
							// fprintf(stderr, "result: %d %s\n", xsTypeOf(result), xsToString(result));
							if (xsIsInstanceOf(xsVar(2), xsArrayBufferPrototype)) {
								responseLength = xsGetArrayBufferLength(xsVar(2));
								response = xsToArrayBuffer(xsVar(2));
							}
						}
						xsCatch {
							if (xsTypeOf(xsException) != xsUndefinedType) {
								fprintf(stderr, "%c computing response %d", command, xsTypeOf(xsVar(1)));
								fprintf(stderr, " %d:", xsTypeOf(xsVar(2)));
								fprintf(stderr, " %s:", xsToString(xsVar(2)));
								fprintf(stderr, " %s\n", xsToString(xsException));
								xsException = xsUndefined;
							}
						}
						// fprintf(stderr, "response of %d bytes\n", responseLength);
						writeError = fxWriteOkay(toParent, meterIndex, the, response, responseLength);
					}
				}
				xsEndHost(machine);
				if (writeError != 0) {
					fprintf(stderr, "%s\n", fxWriteNetStringError(writeError));
					c_exit(E_IO_ERROR);
				}
				break;
			case 's':
			case 'm':
				xsBeginCrank(machine, gxCrankMeteringLimit);
				path = nsbuf + 1;
				xsBeginHost(machine);
				{
					xsVars(1);
					xsTry {
						// ISSUE: realpath necessary? realpath(x, x) doesn't seem to work.
						if (command == 'm')
							xsRunModuleFile(path);
						else
							xsRunProgramFile(path);
					}
					xsCatch {
						if (xsTypeOf(xsException) != xsUndefinedType) {
							fprintf(stderr, "%s\n", xsToString(xsException));
							error = E_UNHANDLED_EXCEPTION;
							xsException = xsUndefined;
						}
					}
				}
				xsEndHost(machine);
				fxRunLoop(machine);
				meterIndex = xsEndCrank(machine);
				if (error == 0) {
					int writeError = fxWriteOkay(toParent, meterIndex, machine, "", 0);
					if (writeError != 0) {
						fprintf(stderr, "%s\n", fxWriteNetStringError(writeError));
						c_exit(E_IO_ERROR);
					}
				} else {
					// TODO: dynamically build error message including Exception message.
					int writeError = fxWriteNetString(toParent, "!", "", 0);
					if (writeError != 0) {
						fprintf(stderr, "%s\n", fxWriteNetStringError(writeError));
						c_exit(E_IO_ERROR);
					}
				}
				break;

			case 'w':
			#if XSNAP_TEST_RECORD
				fxTestRecord(mxTestRecordParam, nsbuf + 1, nslen - 1);
			#endif
				path = nsbuf + 1;
				snapshot.stream = fopen(path, "wb");
				if (snapshot.stream) {
					fxWriteSnapshot(machine, &snapshot);
					fclose(snapshot.stream);
				}
				else
					snapshot.error = errno;
				if (snapshot.error) {
					fprintf(stderr, "cannot write snapshot %s: %s\n",
							path, strerror(snapshot.error));
					c_exit(E_IO_ERROR);
				}
				if (snapshot.error == 0) {
					int writeError = fxWriteOkay(toParent, meterIndex, machine, "", 0);
					if (writeError != 0) {
						fprintf(stderr, "%s\n", fxWriteNetStringError(writeError));
						c_exit(E_IO_ERROR);
					}
				} else {
					// TODO: dynamically build error message including Exception message.
					int writeError = fxWriteNetString(toParent, "!", "", 0);
					if (writeError != 0) {
						fprintf(stderr, "%s\n", fxWriteNetStringError(writeError));
						c_exit(E_IO_ERROR);
					}
				}
				break;
			case -1:
			default:
				done = 1;
				break;
			}
			free(nsbuf);
		}
		xsBeginHost(machine);
		{
			if (xsTypeOf(xsException) != xsUndefinedType) {
				fprintf(stderr, "%s\n", xsToString(xsException));
				error = E_UNHANDLED_EXCEPTION;
			}
		}
		xsEndHost(machine);
	}
	xsEndMetering(machine);
	if (machine->abortStatus) {
		switch (machine->abortStatus) {
		case xsNotEnoughMemoryExit:
			error = E_NOT_ENOUGH_MEMORY;
			break;
		case xsStackOverflowExit:
			error = E_STACK_OVERFLOW;
			break;
		case xsNoMoreKeysExit:
			error = E_NO_MORE_KEYS;
			break;
		case xsTooMuchComputationExit:
			error = E_TOO_MUCH_COMPUTATION;
			break;
		default:
			error = E_UNKNOWN_ERROR;
			break;
		}
	}
	if (error != E_SUCCESS) {
		c_exit(error);
	}
	xsDeleteMachine(machine);
	fxTerminateSharedCluster();
	return E_SUCCESS;
}

void xsBuildAgent(xsMachine* machine)
{
	xsBeginHost(machine);
	xsVars(1);
	
// 	xsResult = xsNewHostFunction(xs_clearTimer, 1);
// 	xsDefine(xsGlobal, xsID("clearImmediate"), xsResult, xsDontEnum);
	xsResult = xsNewHostFunction(xs_setImmediate, 1);
	xsDefine(xsGlobal, xsID("setImmediate"), xsResult, xsDontEnum);
	
// 	xsResult = xsNewHostFunction(xs_clearTimer, 1);
// 	xsDefine(xsGlobal, xsID("clearInterval"), xsResult, xsDontEnum);
// 	xsResult = xsNewHostFunction(xs_setInterval, 1);
// 	xsDefine(xsGlobal, xsID("setInterval"), xsResult, xsDontEnum);
	
// 	xsResult = xsNewHostFunction(xs_clearTimer, 1);
// 	xsDefine(xsGlobal, xsID("clearTimeout"), xsResult, xsDontEnum);
// 	xsResult = xsNewHostFunction(xs_setTimeout, 1);
// 	xsDefine(xsGlobal, xsID("setTimeout"), xsResult, xsDontEnum);
	
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

// 	xsResult = xsNewObject();
// 	xsVar(0) = xsNewHostFunction(fx_print, 0);
// 	xsDefine(xsResult, xsID("log"), xsVar(0), xsDontEnum);
// 	xsDefine(xsGlobal, xsID("console"), xsResult, xsDontEnum);

	xsEndHost(machine);
}

void xsPrintUsage()
{
	printf("xsnap [-h] [-i <interval>] [-l <limit>] [-s <size>] [-m] [-r <snapshot>] [-s] [-v]\n");
	printf("\t-h: print this help message\n");
	printf("\t-i <interval>: metering interval (default to 1)\n");
	printf("\t-l <limit>: metering limit (default to none)\n");
	printf("\t-s <size>: parser buffer size, in kB (default to 8192)\n");
	printf("\t-r <snapshot>: read snapshot to create the XS machine\n");
	printf("\t-v: print XS version\n");
}

void xs_clearTimer(xsMachine* the)
{
	xsClearTimer();
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

void xs_performance_now(xsMachine *the)
{
	c_timeval tv;
	c_gettimeofday(&tv, NULL);
	xsResult = xsNumber((double)(tv.tv_sec * 1000.0) + ((double)(tv.tv_usec) / 1000.0));
}

void xs_print(xsMachine* the)
{
	xsIntegerValue c = xsToInteger(xsArgc), i;
#if mxMetering
	if (gxMeteringPrint)
		fprintf(stdout, "[%u] ", xsGetCurrentMeter(the));
#endif
	for (i = 0; i < c; i++) {
		if (i)
			fprintf(stdout, " ");
		fprintf(stdout, "%s", xsToString(xsArg(i)));
	}
	fprintf(stdout, "\n");
		fflush(stdout);
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


static int fxReadNetString(FILE *inStream, char** dest, size_t* len)
{
	int code = 0;
	char* buf = NULL;

	if (fscanf(inStream, "%9lu", len) < 1) {
		/* >999999999 bytes is bad */
		code = 1;
	} else if (fgetc(inStream) != ':') {
		code = 2;
	} else {
		buf = malloc(*len + 1); /* malloc(0) is not portable */
		if (!buf) {
			code = 3;
		} else if (fread(buf, 1, *len, inStream) < *len) {
			code = 4;
		} else if (fgetc(inStream) != ',') {
			code = 5;
		} else {
			*(buf + *len) = 0;
		}
		if (code == 0) {
			*dest = buf;
		} else {
			*dest = 0;
			free(buf);
		}
	}
	return code;
}

static char* fxReadNetStringError(int code)
{
	switch (code) {
	case 0: return "OK";
	case 1: return "Cannot read netstring, reading length prefix, fscanf";
	case 2: return "Cannot read netstring, invalid delimiter or end of file, fgetc";
	case 3: return "Cannot read netstring, cannot allocate message buffer, malloc";
	case 4: return "Cannot read netstring, cannot read message body, fread";
	case 5: return "Cannot read netstring, cannot read trailer, fgetc";
	default: return "Cannot read netstring";
	}
}

static int fxWriteOkay(FILE* outStream, xsUnsignedValue meterIndex, xsMachine *the, char* buf, size_t length)
{
	char fmt[] = ("." // OK
				  "{"
				  "\"compute\":%u,"
				  "\"allocate\":%u}"
				  "\1" // separate meter info from result
				  );
	char numeral64[] = "12345678901234567890"; // big enough for 64bit numeral
	char prefix[8 + sizeof fmt + 8 * sizeof numeral64];
	// Prepend the meter usage to the reply.
	snprintf(prefix, sizeof(prefix) - 1, fmt,
			 meterIndex, the->allocatedSpace);
	return fxWriteNetString(outStream, prefix, buf, length);
}

static int fxWriteNetString(FILE* outStream, char* prefix, char* buf, size_t length)
{
	if (fprintf(outStream, "%lu:%s", length + strlen(prefix), prefix) < 1) {
		return 1;
	} else if (fwrite(buf, 1, length, outStream) < length) {
		return 2;
	} else if (fputc(',', outStream) == EOF) {
		return 3;
	} else if (fflush(outStream) < 0) {
		return 4;
	}

	return 0;
}

static char* fxWriteNetStringError(int code)
{
	switch (code) {
	case 0: return "OK";
	case 1: return "Cannot write netstring, error writing length prefix";
	case 2: return "Cannot write netstring, error writing message body";
	case 3: return "Cannot write netstring, error writing terminator";
	case 4: return "Cannot write netstring, error flushing stream, fflush";
	default: return "Cannot write netstring";
	}
}

static void xs_issueCommand(xsMachine *the)
{
	int argc = xsToInteger(xsArgc);
	if (argc < 1) {
		xsTypeError("expected ArrayBuffer");
	}

	size_t length;
	char* buf = NULL;
	length = xsGetArrayBufferLength(xsArg(0));

	buf = malloc(length);
	if (!buf) {
		fxAbort(the, xsNotEnoughMemoryExit);
	}

	xsGetArrayBufferData(xsArg(0), 0, buf, length);
	int writeError = fxWriteNetString(toParent, "?", buf, length);

	free(buf);

	if (writeError != 0) {
		xsUnknownError(fxWriteNetStringError(writeError));
	}

	// read netstring
	size_t len;
	int readError = fxReadNetString(fromParent, &buf, &len);
	if (readError != 0) {
		xsUnknownError(fxReadNetStringError(readError));
	}

#if XSNAP_TEST_RECORD
	fxTestRecord(mxTestRecordJSON | mxTestRecordReply, buf, len);
#endif
	xsResult = xsArrayBuffer(buf, len);
	free(buf);
}

#if XSNAP_TEST_RECORD

static char directory[PATH_MAX];
void fxTestRecordArgs(int argc, char* argv[])
{
	struct timeval tv;
	struct tm* tm_info;
	gettimeofday(&tv, NULL);
	char path[PATH_MAX];
	FILE* file;
	mkdir("xsnap-tests", 0755);
	tm_info = localtime(&tv.tv_sec);
	strftime(path, sizeof(path), "%Y-%m-%d-%H-%M-%S", tm_info);
	sprintf(directory, "xsnap-tests/%s-%3.3d", path, tv.tv_usec / 1000);
	mkdir(directory, 0755);
	sprintf(path, "%s/args.sh", directory);
	file = fopen(path, "w");
	if (file) {
		int argi;
		for (argi = 0; argi < argc; argi++)
			fprintf(file, " %s", argv[argi]);
		fprintf(file, "\n");
		fclose(file);
	}
}

void fxTestRecord(int flags, void* buffer, size_t length)
{
	char path[PATH_MAX];
	FILE* file;
	if (flags & mxTestRecordParam) {
		sprintf(path, "%s/param-%d", directory, gxTestRecordReplyIndex);
		gxTestRecordReplyIndex++;
	}
	else {
		sprintf(path, "%s/reply-%d", directory, gxTestRecordParamIndex);
		gxTestRecordParamIndex++;
	}
	if (flags & mxTestRecordJS)
		strcat(path, ".js");
	else if (flags & mxTestRecordJSON)
		strcat(path, ".json");
	else
		strcat(path, ".txt");
	file = fopen(path, "wb");
	if (file) {
		fwrite(buffer, 1, length, file);
		fclose(file);
	}
}

#endif

// Local Variables:
// tab-width: 4
// c-basic-offset: 4
// indent-tabs-mode: t
// End:
// vim: noet ts=4 sw=4
