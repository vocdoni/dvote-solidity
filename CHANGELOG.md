# DVote Solidity Changelog

## 0.7.0

Substantial Voting contract refactor to support a wide range of participatory processes

- Adding `mode`, `envelopeType` and `status` to every process
    - Process mode flags (auto start, interruptible, dynamic census, vote overwrite, encrypted metadata)
    - Envelope type flags (serial envelopes, anonymous voting, encrypted votes)
    - Status (ready, ended, canceled, paused, results)
    - Providing TypeScript wrappers to work with them
- Adding `questionIndex` and `questionCount` for serial voting
- Adding `maxValue`, `uniqueValues`, `maxTotalCost`, `costExponent`, `maxVotesOverwrite` and `paramsSignature` to parameterize processes
- Introducing namespaces
  - Chain ID, genesis data, validators and oracles now belong to a namespace
  - Global getters are replaced by `getNamespace()`
- Unified naming conventions for getters, setters and events
- Condensed contract parameters into tuples
- `getProcessId()` is now pure
  - The processId is computed using the namespace instead of the genesis data and the chainId
- Using Solidity 0.6.x
- Testing using in-memory Ganache server, which enables self-sufficient CI tests
- Refactoring the tests to run with Ethers.js

## 0.6.0

- Refactoring the testcases to use Ethers.js
- Use an in-memory internal Ganache testnet to test
