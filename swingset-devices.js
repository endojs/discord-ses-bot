import {
  buildBridge
} from '@agoric/swingset-vat'

export function prepareDevices ({ doOutboundBridge }) {
  function bridgeOutbound (dstID, obj) {
    // console.warn('would outbound bridge', dstID, obj)
    return doOutboundBridge(dstID, obj)
  }
  const bridgeDevice = buildBridge(bridgeOutbound)
  const deviceConfig = {
    bridge: {
      sourceSpec: bridgeDevice.srcPath
    }
  }
  const deviceEndowments = {
    bridge: {
      ...bridgeDevice.endowments
    }
  }
  const devices = {
    bridge: bridgeDevice
  }
  return { devices, deviceConfig, deviceEndowments }
}
