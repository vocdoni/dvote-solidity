# DVote Solidity Changelog

## 0.7.0

- Substantial Voting contract upgrade to support a wide range of participatory processes
    - Adding `mode`, `envelopeType` and `status`
        - Auto start
        - Interruptible processes
        - Vote overwrite
        - Encrypted votes and/or metadata
        - Serial envelope submission (assembly mode)
        - Anonymous voters
    - Adding `questionIndex` and `questionCount`
    - Adding `maxValue`, `uniqueValues`, `maxTotalCost`, `costExponent`, `maxVotesOverwrite`, `paramsSignature` and `namespace`
- Providing TypeScript wrappers for the process flags (mode, envelopetype and status)
- Using Solidity 0.6.0

## 0.6.0

- Refactoring the testcases to use Ethers.js
- Use an in-memory internal Ganache testnet to test
