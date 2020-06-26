# DVote Solidity Changelog

## 0.7.0

- Substantial Voting contract refactor to support a wide range of participatory processes
    - Adding `mode`, `envelopeType` and `status`
        - Auto start
        - Interruptible processes
        - Vote overwrite
        - Encrypted votes and/or metadata
        - Serial envelope submission (assembly mode)
        - Anonymous voters
    - Adding `questionIndex` and `questionCount`
    - Adding `maxValue`, `uniqueValues`, `maxTotalCost`, `costExponent`, `maxVotesOverwrite`, `paramsSignature` and `namespace`
    - Unify the naming conventions of the getters/setters
    - Using 5 status: `READY, ENDED, CANCELED, PAUSED, RESULTS`
- Providing TypeScript wrappers for the process flags (mode, envelopetype and status)
- Introducing namespaces
- Condensed parameters into tuples
- `getProcessId` is now pure
  - The processId is computed using the namespace instead of the genesis data and the chainId
- Global getters condensed into `getNamespace()`
  - Chain ID, Genesis, validators and oracles
- Using Solidity 0.6.9

## 0.6.0

- Refactoring the testcases to use Ethers.js
- Use an in-memory internal Ganache testnet to test
