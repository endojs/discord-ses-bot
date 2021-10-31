% : %.c
%.o : %.c

GOAL ?= debug
NAME = xsnap-worker
ifneq ($(VERBOSE),1)
MAKEFLAGS += --silent
endif

# MODDABLE = $(CURDIR)/../../moddable
BUILD_DIR = $(CURDIR)/../../build
TLS_DIR = $(CURDIR)/../../sources

# BUILD_DIR = $(MODDABLE)/build
# TLS_DIR = ../../sources

XS_DIR = $(MODDABLE)/xs

BIN_DIR = $(BUILD_DIR)/bin/lin/$(GOAL)
INC_DIR = $(XS_DIR)/includes
PLT_DIR = $(XS_DIR)/platforms
SRC_DIR = $(XS_DIR)/sources
TMP_DIR = $(BUILD_DIR)/tmp/lin/$(GOAL)/$(NAME)

C_OPTIONS = \
	-fno-common \
	-DINCLUDE_XSPLATFORM \
	-DXSPLATFORM=\"xsnapPlatform.h\" \
	-DXSNAP_VERSION=\"$(XSNAP_VERSION)\" \
	-DXSNAP_TEST_RECORD=0 \
	-DmxMetering=1 \
	-DmxDebug=1 \
	-DmxBoundsCheck=1 \
	-DmxParse=1 \
	-DmxRun=1 \
	-DmxSloppy=1 \
	-DmxSnapshot=1 \
	-DmxRegExpUnicodePropertyEscapes=1 \
	-I$(INC_DIR) \
	-I$(PLT_DIR) \
	-I$(SRC_DIR) \
	-I$(TLS_DIR) \
	-I$(TMP_DIR)
C_OPTIONS += \
	-Wno-misleading-indentation \
	-Wno-implicit-fallthrough
ifeq ($(GOAL),debug)
	C_OPTIONS += -g -O0 -Wall -Wextra -Wno-missing-field-initializers -Wno-unused-parameter
else
	C_OPTIONS += -DmxNoConsole=1 -O3
endif

LIBRARIES = -ldl -lm -lpthread

LINK_OPTIONS = -rdynamic

OBJECTS = \
	$(TMP_DIR)/xsAll.o \
	$(TMP_DIR)/xsAPI.o \
	$(TMP_DIR)/xsArguments.o \
	$(TMP_DIR)/xsArray.o \
	$(TMP_DIR)/xsAtomics.o \
	$(TMP_DIR)/xsBigInt.o \
	$(TMP_DIR)/xsBoolean.o \
	$(TMP_DIR)/xsCode.o \
	$(TMP_DIR)/xsCommon.o \
	$(TMP_DIR)/xsDataView.o \
	$(TMP_DIR)/xsDate.o \
	$(TMP_DIR)/xsDebug.o \
	$(TMP_DIR)/xsDefaults.o \
	$(TMP_DIR)/xsError.o \
	$(TMP_DIR)/xsFunction.o \
	$(TMP_DIR)/xsGenerator.o \
	$(TMP_DIR)/xsGlobal.o \
	$(TMP_DIR)/xsJSON.o \
	$(TMP_DIR)/xsLexical.o \
	$(TMP_DIR)/xsMapSet.o \
	$(TMP_DIR)/xsMarshall.o \
	$(TMP_DIR)/xsMath.o \
	$(TMP_DIR)/xsMemory.o \
	$(TMP_DIR)/xsModule.o \
	$(TMP_DIR)/xsNumber.o \
	$(TMP_DIR)/xsObject.o \
	$(TMP_DIR)/xsPlatforms.o \
	$(TMP_DIR)/xsProfile.o \
	$(TMP_DIR)/xsPromise.o \
	$(TMP_DIR)/xsProperty.o \
	$(TMP_DIR)/xsProxy.o \
	$(TMP_DIR)/xsRegExp.o \
	$(TMP_DIR)/xsRun.o \
	$(TMP_DIR)/xsScope.o \
	$(TMP_DIR)/xsScript.o \
	$(TMP_DIR)/xsSnapshot.o \
	$(TMP_DIR)/xsSourceMap.o \
	$(TMP_DIR)/xsString.o \
	$(TMP_DIR)/xsSymbol.o \
	$(TMP_DIR)/xsSyntaxical.o \
	$(TMP_DIR)/xsTree.o \
	$(TMP_DIR)/xsType.o \
	$(TMP_DIR)/xsdtoa.o \
	$(TMP_DIR)/xsre.o \
	$(TMP_DIR)/xsmc.o \
	$(TMP_DIR)/textdecoder.o \
	$(TMP_DIR)/textencoder.o \
	$(TMP_DIR)/modBase64.o \
	$(TMP_DIR)/xsnapPlatform.o \
	$(TMP_DIR)/xsnap-worker.o

VPATH += $(SRC_DIR) $(TLS_DIR)
VPATH += $(MODDABLE)/modules/data/text/decoder
VPATH += $(MODDABLE)/modules/data/text/encoder
VPATH += $(MODDABLE)/modules/data/base64

build: $(TMP_DIR) $(BIN_DIR) $(BIN_DIR)/$(NAME)

$(TMP_DIR):
	mkdir -p $(TMP_DIR)

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

$(BIN_DIR)/$(NAME): $(OBJECTS)
	@echo "#" $(NAME) $(GOAL) ": cc" $(@F)
	$(CC) $(LINK_OPTIONS) $(OBJECTS) $(LIBRARIES) -o $@

$(OBJECTS): $(TLS_DIR)/xsnap.h
$(OBJECTS): $(TLS_DIR)/xsnapPlatform.h
$(OBJECTS): $(PLT_DIR)/xsPlatform.h
$(OBJECTS): $(SRC_DIR)/xsCommon.h
$(OBJECTS): $(SRC_DIR)/xsAll.h
$(OBJECTS): $(SRC_DIR)/xsScript.h
$(OBJECTS): $(SRC_DIR)/xsSnapshot.h
$(OBJECTS): $(INC_DIR)/xs.h
$(TMP_DIR)/%.o: %.c
	@echo "#" $(NAME) $(GOAL) ": cc" $(<F)
	$(CC) $< $(C_OPTIONS) -c -o $@

clean:
	rm -rf $(BUILD_DIR)/bin/lin/debug/$(NAME)
	rm -rf $(BUILD_DIR)/bin/lin/release/$(NAME)
	rm -rf $(BUILD_DIR)/tmp/lin/debug/$(NAME)
	rm -rf $(BUILD_DIR)/tmp/lin/release/$(NAME)
