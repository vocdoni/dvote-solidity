const HDWalletProvider = require("truffle-hdwallet-provider")
const { getConfig } = require("./lib/util")

const config = getConfig()

// See <http://truffleframework.com/docs/advanced/configuration>

module.exports = {
  networks: {
    // development: {
    //   host: "127.0.0.1",
    //   port: 8545,
    //   network_id: "*" // Match any network id
    // },
    development: {
      provider: function () {
        return new HDWalletProvider(config.MNEMONIC, config.GATEWAY_URL)
      },
      network_id: config.NETWORK_ID
    },
    staging: {
      provider: function () {
        return new HDWalletProvider(config.MNEMONIC, config.GATEWAY_URL)
      },
      network_id: config.NETWORK_ID
    }
  },
  compilers: {
    solc: {
      version: "0.5.0",
    },
  },
}
