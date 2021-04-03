
const mapHandlers = {
  get: (target, key) => {
    return target.get(key)
  },
  getOwnPropertyDescriptor: (target, key) => {
    if (target.has(key)) {
      return { value: target.get(key), enumberable: true, writable: false, configurable: false }
    } else {
      return undefined
    }
  },
  getPrototypeOf: (target) => {
    return null
  },
  has: (target, key) => {
    return target.has(key)
  },
  isExtensible: (target) => {
    return false
  },
  ownKeys: (target) => {
    return [...target.keys()]
  },
  apply: (target) => {
    throw new Error('pretty sure this is impossible')
  },
  construct: (target) => {
    throw new Error('pretty sure this is impossible')
  }
}

function createReadOnlyMapProxy (map, resultTransform) {
  return createReadOnlyProxy(map, resultTransform, mapHandlers)
}

function createReadOnlyProxy (target, resultTransform = (x) => x, handlers = Reflect) {
  return new Proxy({}, {
    // read hooks
    get: (_, ...args) => {
      return handlers.get(target, ...args)
    },
    getOwnPropertyDescriptor: (_, ...args) => {
      return handlers.getOwnPropertyDescriptor(target, ...args)
    },
    getPrototypeOf: (_, ...args) => {
      return handlers.getPrototypeOf(target, ...args)
    },
    has: (_, ...args) => {
      return handlers.has(target, ...args)
    },
    isExtensible: (_, ...args) => {
      return handlers.isExtensible(target, ...args)
    },
    ownKeys: (_, ...args) => {
      return handlers.ownKeys(target, ...args)
    },
    // fn/constructor hooks
    apply: (_, ...args) => {
      return handlers.apply(target, ...args)
    },
    construct: (_, ...args) => {
      return handlers.construct(target, ...args)
    },
    // mutation hooks
    defineProperty: (_, ...args) => {
      throw new Error('createReadOnlyProxy: mutation not allowed')
    },
    deleteProperty: (_, ...args) => {
      throw new Error('createReadOnlyProxy: mutation not allowed')
    },
    preventExtensions: (_, ...args) => {
      throw new Error('createReadOnlyProxy: mutation not allowed')
    },
    set: (_, ...args) => {
      throw new Error('createReadOnlyProxy: mutation not allowed')
    },
    setPrototypeOf: (_, ...args) => {
      throw new Error('createReadOnlyProxy: mutation not allowed')
    }
  })
}

module.exports = {
  createReadOnlyMapProxy,
  createReadOnlyProxy
}
