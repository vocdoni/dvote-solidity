# dvote-smart-contracts
Solidity smart contracts implementing the voting functionality

## Developing
Make sure you `npm install`, as all dependencies (including but not limited to Truffle and Ganache-cli) will be installed locally.

Start a local blockchain:
    `npm run ganache`

Run the test suite locally
    `npm test`

Compile and export the contracts ABI and Bytecode:
    `npm run export`

## Testing
Testing can also be run on a remote blockchain, if needed:
    `npm run test:remote`

### pragma solidity ^0.5.0;
`0.5.0` version of Solc was recently released. This version includes a lot of improvements over the previous release, but it has [breaking changes](https://solidity.readthedocs.io/en/latest/050-breaking-changes.html).
