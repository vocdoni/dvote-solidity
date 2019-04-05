const { getProvider } = require("../lib/util")

const provider = getProvider()

// SET A GLOBAL TIMEOUT
const timeout = setTimeout(() => process.exit(1), 1000 * 30)

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
