const compartmentOptions = {
  // We use sloppy globals so each user gets a global lexical contour.
  sloppyGlobalsMode: true,
};

export function createKernel () {
  const authorMap = new Map()
  const shareBoxes = new Map()
  const inboxes = new Map()

  return {
    handleCommand
  }

  function help () {
    return `Welcome to SES-bot!
    
    You can run JavaScript commands with the "$" prefix, and they are run in your own personal SES container!
    You can't assign variables in these commands, but you have a "my" object you can hang variables on.
    You can also add objects to your "share" object, to make them available to everyone.
    You can find the objects others have shared in your "others" object, by their ID.
    You can send an object to a specific user by calling "send(otherId, label, object)".
    They can access objects sent from you at their "inbox[yourId][yourLabel]".
    A member can have SES-bot print their ID by calling "/eval id".
    You can safely try out a command without committing to it with the "?" prefix.
    You can read my source code here: https://github.com/danfinlay/discord-ses-bot
    `
  }

  // this function handles messages from xsnap, by its name
  /* eslint-disable-next-line no-unused-vars */
  function handleCommand (request) {
    const { authorId, command } = request

    if (authorId === 'system' && command === 'systemState') {
      return {
        authorsState: getAuthorsState(),
        shareBoxes: mapToObj(shareBoxes),
        inboxes: mapToObj(inboxes)
      }
    }

    const author = getAuthor(authorId)
    let result, error
    try {
      result = author.compartment.evaluate(command, compartmentOptions)
    } catch (err) {
      error = {
        message: err.message
        // this causes is non determinism
        // stack: err.stack
      }
    }
    return serializeOutput({ error, result })
  }

  function getAuthorsState () {
    const state = {}
    for (const [authorId, author] of authorMap.entries()) {
      state[authorId] = { my: author.compartment.globalThis.my }
    }
    return state
  }

  function getAuthor (id) {
    let author = authorMap.get(id)
    if (!author) {
      author = createUser(id)
      authorMap.set(id, author)
    }
    return author
  }

  function createUser (id) {
    // for sharing publicly, multicast
    // set via "share"
    const shareBox = {}
    shareBoxes.set(id, shareBox)
    // for sharing privately, unicast
    // receives from "send"
    const inbox = {}
    inboxes.set(id, inbox)
    /* eslint-disable-next-line no-undef */
    const compartment = new Compartment({
      id: id,
      my: {},
      share: shareBox,
      inbox,
      // print: console.log,
      help,
      send: (to, label, value) => {
        sendValueBetweenAuthors(id, to, label, value)
      },
      // expose the shareBoxes map as an object that returns read only interfaces
      others: createReadOnlyMapProxy(shareBoxes, (otherShareBox) => createReadOnlyProxy(otherShareBox))
    })
    return {
      compartment
    }
  }

  function sendValueBetweenAuthors (from, to, label, value) {
    if (!inboxes.has(to)) {
      throw new Error(`no inbox for user "${to}"`)
    }
    const recipientBox = inboxes.get(to)

    let myBox = recipientBox[from]
    if (!myBox) {
      myBox = {}
      recipientBox[from] = myBox
    }

    myBox[label] = value
  }

  function createMapProxyHandlers () {
    return {
      get: (target, key) => {
        return target.get(key)
      },
      getOwnPropertyDescriptor: (target, key) => {
        if (target.has(key)) {
          return { value: target.get(key), enumberable: true, writable: false, configurable: true }
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
  }

  function createReadOnlyMapProxy (map, resultTransform) {
    return createReadOnlyProxy(map, resultTransform, createMapProxyHandlers())
  }

  function createReadOnlyProxy (target, resultTransform = (x) => x, handlers = Reflect) {
    // if target is an object, return as is
    if (target === undefined || Object(target) !== target) {
      return target
    }
    return new Proxy({}, {
      // read hooks
      get: (_, ...args) => {
        return resultTransform(handlers.get(target, ...args))
      },
      getOwnPropertyDescriptor: (_, ...args) => {
        return resultTransform(handlers.getOwnPropertyDescriptor(target, ...args))
      },
      getPrototypeOf: (_, ...args) => {
        return resultTransform(handlers.getPrototypeOf(target, ...args))
      },
      has: (_, ...args) => {
        return resultTransform(handlers.has(target, ...args))
      },
      isExtensible: (_, ...args) => {
        return resultTransform(handlers.isExtensible(target, ...args))
      },
      ownKeys: (_, ...args) => {
        return resultTransform(handlers.ownKeys(target, ...args))
      },
      // fn/constructor hooks
      apply: (_, ...args) => {
        return resultTransform(handlers.apply(target, ...args))
      },
      construct: (_, ...args) => {
        return resultTransform(handlers.construct(target, ...args))
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

  function mapToObj (map) {
    return Object.fromEntries(map.entries())
  }
}

function serializeOutput (value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch (err) {
    return '{ "error": "<failed to serialize result>" }'
  }
}
