#ifndef __XSNAP__
#define __XSNAP__

#include "xs.h"

typedef struct xsSnapshotRecord xsSnapshot;

struct xsSnapshotRecord {
	char* signature;
	int signatureLength;
	xsCallback* callbacks;
	int callbacksLength;
	int (*read)(void* stream, void* address, size_t size);
	int (*write)(void* stream, void* address, size_t size);
	void* stream;
	int error;
	void* firstChunk;
	void* firstProjection;
	void* firstSlot;
};

#define xsInitializeSharedCluster() \
	fxInitializeSharedCluster()
#define xsTerminateSharedCluster() \
	fxTerminateSharedCluster()

#ifdef mxMetering

#define xsBeginMetering(_THE, _CALLBACK, _STEP) \
	do { \
		xsJump __HOST_JUMP__; \
		__HOST_JUMP__.nextJump = (_THE)->firstJump; \
		__HOST_JUMP__.stack = (_THE)->stack; \
		__HOST_JUMP__.scope = (_THE)->scope; \
		__HOST_JUMP__.frame = (_THE)->frame; \
		__HOST_JUMP__.environment = NULL; \
		__HOST_JUMP__.code = (_THE)->code; \
		__HOST_JUMP__.flag = 0; \
		(_THE)->firstJump = &__HOST_JUMP__; \
		if (setjmp(__HOST_JUMP__.buffer) == 0) { \
			fxBeginMetering(_THE, _CALLBACK, _STEP)

#define xsEndMetering(_THE) \
			fxEndMetering(_THE); \
		} \
		(_THE)->stack = __HOST_JUMP__.stack, \
		(_THE)->scope = __HOST_JUMP__.scope, \
		(_THE)->frame = __HOST_JUMP__.frame, \
		(_THE)->code = __HOST_JUMP__.code, \
		(_THE)->firstJump = __HOST_JUMP__.nextJump; \
		break; \
	} while(1)
			
#define xsGetCurrentMeter(_THE) \
	fxGetCurrentMeter(_THE)
#define xsSetCurrentMeter(_THE, _VALUE) \
	fxSetCurrentMeter(_THE, _VALUE)

#else
	#define xsBeginMetering(_THE, _CALLBACK, _STEP)
	#define xsEndMetering(_THE)
	#define xsPatchHostFunction(_FUNCTION,_PATCH)
	#define xsMeterHostFunction(_COUNT) (void)(_COUNT)
	#define xsGetCurrentMeter(_THE) 0
	#define xsSetCurrentMeter(_THE, _VALUE)
#endif

#define xsReadSnapshot(_SNAPSHOT, _NAME, _CONTEXT) \
	fxReadSnapshot(_SNAPSHOT, _NAME, _CONTEXT)
#define xsWriteSnapshot(_THE, _SNAPSHOT) \
	fxWriteSnapshot(_THE, _SNAPSHOT)
	
#define xsRunModuleFile(_PATH) \
	fxRunModuleFile(the, _PATH)
#define xsRunProgramFile(_PATH) \
	fxRunProgramFile(the, _PATH)
#define xsRunLoop(_THE) \
	fxRunLoop(_THE)

#define xsClearTimer() \
	fxClearTimer(the)
#define xsSetTimer(_INTERVAL, _REPEAT) \
	fxSetTimer(the, _INTERVAL, _REPEAT)
	
#define xsVersion(_BUFFER, _SIZE) \
	fxVersion(_BUFFER, _SIZE)

#ifdef __cplusplus
extern "C" {
#endif

extern void fxInitializeSharedCluster();
extern void fxTerminateSharedCluster();

#ifdef mxMetering
mxImport void fxBeginMetering(xsMachine* the, xsBooleanValue (*callback)(xsMachine*, xsUnsignedValue), xsUnsignedValue interval);
mxImport void fxEndMetering(xsMachine* the);
mxImport void fxMeterHostFunction(xsMachine* the, xsUnsignedValue count);
mxImport void fxPatchHostFunction(xsMachine* the, xsCallback patch);
mxImport xsUnsignedValue fxGetCurrentMeter(xsMachine* the);
mxImport void fxSetCurrentMeter(xsMachine* the, xsUnsignedValue value);
#endif

mxImport xsMachine* fxReadSnapshot(xsSnapshot* snapshot, xsStringValue theName, void* theContext);
mxImport int fxWriteSnapshot(xsMachine* the, xsSnapshot* snapshot);

mxImport void fxRunModuleFile(xsMachine* the, xsStringValue path);
mxImport void fxRunProgramFile(xsMachine* the, xsStringValue path);
mxImport void fxRunLoop(xsMachine* the);

mxImport void fxClearTimer(xsMachine* the);
mxImport void fxSetTimer(xsMachine* the, xsNumberValue interval, xsBooleanValue repeat);

mxImport void fxVersion(xsStringValue theBuffer, xsUnsignedValue theSize);

mxImport void fx_lockdown(xsMachine* the);
mxImport void fx_harden(xsMachine* the);
mxImport void fx_purify(xsMachine* the);

#ifdef __cplusplus
}
#endif

#endif /* __XSNAP__ */
