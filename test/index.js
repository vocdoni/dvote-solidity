const { getProvider } = require("../lib/util")

const provider = getProvider()

// SET A GLOBAL TIMEOUT
const timeout = setTimeout(() => {
    console.error("Global timeout reached")
    process.exit(1)
}, 1000 * 60 * 1.5)

// HALT WHEN DONE
after(() => {
    clearInterval(timeout)
    provider.engine.stop()
})

// TEST SUITES
describe('DVote Solidity', function () {

    require("./entity-resolver")
    require("./voting-process")

})
