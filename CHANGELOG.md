# DVote Solidity Changelog

## 0.9.0

- Adding `ProcessContractParameters` to wrap and upwrap the params tuples submitted and retrieved from the Smart Contract
- Removing `wrapProcessCreateParams` and `unwrapProcessState`
- Allowing to read the raw `value` from `ProcessMode`, `ProcessEnvelopeType` and `ProcessStatus`

## 0.8.0

- The process contracts are now future proof
  - Instances can now be frozen and forked
  - Process state can be retrieved from any predecessor
  - Two new methods are available `activate` and `activateSuccessor`, to handle the transition with a single source of truth at all times
  - For future versions to interact with deprecated ones, `ProcessStore` is now available as an interface
  - Calls on processes created before `activationBlock` will be forwarded to the instance that holds them
  - Updates on predecessor instances need to be made there, since `msg.sender` would not allow forwarding from the successor
  - Inactive instances won't allow to create new processes or update the census
- The namespace data has been moved to a separate contract (Namespaces)
  - The `NamespaceStore` interface is also available, for all versions to be able to reference it

## 0.7.0

Substantial Voting contract refactor to support a wide range of participatory processes

- Adding `mode`, `envelopeType` and `status` to every process
    - Process mode flags (auto start, interruptible, dynamic census, vote overwrite, encrypted metadata)
    - Envelope type flags (serial envelopes, anonymous voting, encrypted votes)
    - Status (ready, ended, canceled, paused, results)
    - Providing TypeScript wrappers to work with them
- Adding `questionIndex` and `questionCount` for serial voting
- Adding `maxCount`, `maxValue`, `uniqueValues`, `maxTotalCost`, `costExponent`, `maxVotesOverwrite` and `paramsSignature` to parameterize processes
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
