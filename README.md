# dvote-smart-contracts
Solidity smart contracts implementing the voting functionality

## Developing
Make sure you `npm install`, as all dependencies (including but not limited to Truffle and Ganache-cli) will be installed locally.

To run Truffle or Ganache-cli locally you can either run them manually:
    `./node_modules/ganache-cli/cli.js`
    `./node_modules/truffle/build/cli.bundled.js`
or using a shortcut for some common tasks
    `npm test`
    `npm run build`
    `npm run migrate`

### pragma solidity ^0.5.0;
`0.5.0` version of Solc was recently released. This version includes a lot of improvements over the previous release, but it has [breaking changes](https://solidity.readthedocs.io/en/latest/050-breaking-changes.html).

Current Truffle version does not support it, but its `beta` relase does. So, if you are running a Truffle version installed globally (you shouldn't), please make sure you are up to date.

`npm install -g truffle@beta`