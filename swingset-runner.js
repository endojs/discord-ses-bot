#!/usr/bin/env -S node --expose-gc -r esm

// #!/usr/bin/env -S node --inspect-brk --expose-gc -r esm

/**
 * Simple boilerplate program providing linkage to launch an application written using modules within the
 * as yet not-entirely-ESM-supporting version of NodeJS.
 */

// LMDB bindings need to be imported before lockdown.
import 'node-lmdb'

// Now do lockdown.
import './swingset/install-optional-global-metering'
import './install-ses'

import { main } from './swingset-main.js'

main()
