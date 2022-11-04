// this code runs inside xsnap

// must set handleCommand on globalThis for xsnap
globalThis.handleCommand = handleCommand

function help () {
  return `Welcome to SES-bot!
  
  You can run JavaScript commands with the "$" prefix, and they are run in your own personal SES container!
  You can't assign variables in these commands, but you have a "my" object you can hang variables on.
  You can also add objects to your "share" object, to make them available to everyone.
  You can find the objects others have shared in your "others" object, by their ID.
  You can register others in your address book with "book[name] = theirId"
  You can send an object to a specific user by calling "send(otherId, label, object)".
  They can access objects sent from you at their "inbox[yourId][sendLabel]".
  A member can have SES-bot print their ID by calling "?id".
  You can safely try out a command without committing to it with the "?" prefix.
  You can read my source code here: https://github.com/endojs/discord-ses-bot
  `
}

const authorMap = new Map()
const shareBoxes = new Map()
const inboxes = new Map()

// this function handles messages from xsnap, by its name
/* eslint-disable-next-line no-unused-vars */
function handleCommand (request) {
  const commandString = String.fromArrayBuffer(request)
  const { authorId, command } = JSON.parse(commandString)

  if (authorId === 'system' && command === 'systemState') {
    return serializeOutput({
      authorsState: getAuthorsState(),
      shareBoxes: mapToObj(shareBoxes),
      inboxes: mapToObj(inboxes)
    })
  }

  const author = getAuthor(authorId)
  let result, error
  try {
    result = author.compartment.evaluate(command)
  } catch (err) {
    error = {
      message: err.message,
      stack: err.stack
    }
  }
  return serializeOutput({ error, result })
}

function serializeOutput (value) {
  try {
    let { error, result } = value
    const response = {
      error: error && bestEffortStringify(error),
      result: result && bestEffortStringify(result),
    }
    return ArrayBuffer.fromString(JSON.stringify(response, null, 2))
  } catch (err) {
    return ArrayBuffer.fromString('{ "error": "<failed to serialize result>" }')
  }
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
  // address book for easy send
  const book = {}
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
    book,
    share: shareBox,
    inbox: createAddressBookProxy(book, inbox),
    // print: console.log,
    help,
    send: (to, label, value) => {
      sendValueBetweenAuthors(id, mapToAddressWithBook(book, to), label, value)
    },
    // expose the shareBoxes map as an object that returns read only interfaces
    others: createAddressBookProxy(book,
      createReadOnlyMapProxy(shareBoxes, (otherShareBox) => createReadOnlyProxy(otherShareBox))
    )
  })
  return {
    compartment
  }
}

function mapToAddressWithBook (book, rawTo) {
  return book[rawTo] || rawTo
}

function createAddressBookProxy (book, target) {
  return createKeyTransformProxy(target, (rawTo) => mapToAddressWithBook(book, rawTo))
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
  // if target is NOT an object, return as is
  if (target === undefined || Object(target) !== target) {
    return target
  }
  // false proxy target to avoid unintended fallback
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


function createKeyTransformProxy (target, keyTransform = (x) => x, handlers = Reflect) {
  // if target is NOT an object, return as is
  if (target === undefined || Object(target) !== target) {
    return target
  }
  // real proxy target to allow unspecified handlers to work normally
  return new Proxy(target, {
    // read hooks
    get: (_, key, ...args) => {
      return handlers.get(target, keyTransform(key), ...args)
    },
    getOwnPropertyDescriptor: (_, key, ...args) => {
      return handlers.getOwnPropertyDescriptor(target, keyTransform(key), ...args)
    },
    has: (_, key, ...args) => {
      return handlers.has(target, keyTransform(key), ...args)
    },
    // mutation hooks
    defineProperty: (_, key, ...args) => {
      return handlers.defineProperty(target, keyTransform(key), ...args)
    },
    deleteProperty: (_, key, ...args) => {
      return handlers.deleteProperty(target, keyTransform(key), ...args)
    },
    set: (_, key, ...args) => {
      return handlers.set(target, keyTransform(key), ...args)
    },
  })
}

function mapToObj (map) {
  return Object.fromEntries(map.entries())
}

// from https://github.com/endojs/endo/blob/master/packages/ses/src/error/stringify-utils.js
function bestEffortStringify (payload, spaces = undefined) {
  const seenSet = new Set();
  const replacer = (_, val) => {
    switch (typeof val) {
      case 'object': {
        if (val === null) {
          return null;
        }
        if (seenSet.has(val)) {
          return '[Seen]';
        }
        seenSet.add(val);
        if (val instanceof Error) {
          return `[${val.name}: ${val.message}]`;
        }
        if (Symbol.toStringTag in val) {
          // For the built-ins that have or inherit a `Symbol.toStringTag`-named
          // property, most of them inherit the default `toString` method,
          // which will print in a similar manner: `"[object Foo]"` vs
          // `"[Foo]"`. The exceptions are
          //    * `Symbol.prototype`, `BigInt.prototype`, `String.prototype`
          //      which don't matter to us since we handle primitives
          //      separately and we don't care about primitive wrapper objects.
          //    * TODO
          //      `Date.prototype`, `TypedArray.prototype`.
          //      Hmmm, we probably should make special cases for these. We're
          //      not using these yet, so it's not urgent. But others will run
          //      into these.
          //
          // Once #2018 is closed, the only objects in our code that have or
          // inherit a `Symbol.toStringTag`-named property are remotables
          // or their remote presences.
          // This printing will do a good job for these without
          // violating abstraction layering. This behavior makes sense
          // purely in terms of JavaScript concepts. That's some of the
          // motivation for choosing that representation of remotables
          // and their remote presences in the first place.
          return `[${val[Symbol.toStringTag]}]`;
        }
        return val;
      }
      case 'function': {
        return `[Function ${val.name || '<anon>'}]`;
      }
      case 'string': {
        if (val.startsWith('[')) {
          return `[${val}]`;
        }
        return val;
      }
      case 'undefined':
      case 'symbol': {
        return `[${String(val)}]`;
      }
      case 'bigint': {
        return `[${val}n]`;
      }
      case 'number': {
        if (Object.is(val, NaN)) {
          return '[NaN]';
        } else if (val === Infinity) {
          return '[Infinity]';
        } else if (val === -Infinity) {
          return '[-Infinity]';
        }
        return val;
      }
      default: {
        return val;
      }
    }
  };
  return JSON.stringify(payload, replacer, spaces);
};
