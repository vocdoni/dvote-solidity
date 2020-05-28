# DVote Solidity
This repo provides toolkit to interact with the EntityResolver and the VotingProcess smart contracts.

* Smart Contracts source code in Solidity
* JSON files with the contract ABI and the Bytecode of each
* JS/Typescript support to import the JSON ABI and Bytecode

## Get started

Install NodeJS and NPM on your system.

```
npm install dvote-solidity
```

## Usage

To import the ABI and the bytecode:

```javascript
const { EntityResolver, VotingProcess } = require("dvote-solidity")

console.log(EntityResolver.abi)
console.log(EntityResolver.bytecode)

console.log(VotingProcess.abi)
console.log(VotingProcess.bytecode)
```

If you use Typescript, you may need to add `"resolveJsonModule": true` in your `tsconfig.json` file.

Then use Web3 or Ethers.js to attach to an instance or deploy your own:

### Web3

```javascript
const Web3 = require("web3")
const web3 = new Web3(_your_provider_)

function deployEntityResolver() {
	return web3.eth.getAccounts().then(accounts => {
		return new web3.eth.Contract(entityResolverAbi)
			.deploy({ data: entityResolverByteCode })
			.send({ from: accounts[0], gas: "1300000" })
	})
}

function deployVotingProcess() {
	return web3.eth.getAccounts().then(accounts => {
		return new web3.eth.Contract(votingProcessAbi)
			.deploy({ data: votingProcessByteCode })
			.send({ from: accounts[0], gas: "2600000" })
	})
}
```

### Ethers.js

```javascript
const { EntityResolver, VotingProcess } = require("dvote-solidity")
const ethers = require("ethers")
const config = ...

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = EntityResolver
const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = VotingProcess

const provider = new ethers.providers.JsonRpcProvider(config.GATEWAY_URL)

const privateKey = ethers.Wallet.fromMnemonic(config.MNEMONIC).privateKey
const address = await ethers.Wallet.fromMnemonic(config.MNEMONIC).getAddress()

const wallet = new ethers.Wallet(privateKey, provider);

// deploying
const resolverFactory = new ethers.ContractFactory(entityResolverAbi, entityResolverByteCode, wallet)
const processFactory = new ethers.ContractFactory(votingProcessAbi, votingProcessByteCode, wallet)

const resolverInstance = await resolverFactory.deploy()
console.log(resolverInstance.address)

const processInstance = await processFactory.deploy(0, [0, 1, 4, 6, 8, 10, 12, 14], [0, 1, 3])
console.log(processInstance.address)

// or attaching
const resolver = new ethers.Contract(resolverAddress, entityResolverAbi, wallet);
const process = new ethers.Contract(processAddress, votingProcessAbi, wallet);

const tx1 = await resolver.setText(...)
await tx1.wait()
const tx2 = await process.create(...)
await tx2.wait()
```

## Types and values

A Voting Process is defined by the following fields within the contract:

```solidity
struct Process {
    uint8 mode; // The selected process mode. See: https://vocdoni.io/docs/#/architecture/components/process
    uint8 envelopeType; // One of valid envelope types, see: https://vocdoni.io/docs/#/architecture/components/process
    address entityAddress; // The Ethereum address of the Entity
    uint256 startBlock; // Tendermint block number on which the voting process starts
    uint256 blockCount; // Amount of Tendermint blocks during which the voting process is active
    string metadata; // Content Hashed URI of the JSON meta data (See Data Origins)
    string censusMerkleRoot; // Hex string with the Merkle Root hash of the census
    string censusMerkleTree; // Content Hashed URI of the exported Merkle Tree (not including the public keys)
    uint8 status; // One of 0 [open], 1 [ended], 2 [canceled], 3 [paused]
    uint8 questionIndex; // The index of the currently active question (only assembly processes)
    uint8 questionCount; // How many questions the process has (only assembly processes)
    string results; // string containing the results
}
```

Behaviour is defined by the flags on these variables:
- `mode`
  - The process mode (how it behaves)
- `envelopeType`
  - How votes look like
- `status`
  - Whether the process is open, ended, canceled or paused

### Process Mode
Available flags:
- Public / encrypted metadata
- Static / dynamic metadata
- Static / dynamic census
- On-demand / scheduled

Flag encoding: 
```
0x00001111
      ||||
      |||`- On-demand / Scheduled
      ||`- Static / Dynamic census
      |`- Static / Dynamic metadata
      `- Plain / Encrypted meta
```

- `0` implies the first option
- `1` implies the second option

|Name|Value|Plain/Encrypted meta|Static/Dynamic meta|Static/Dynamic census|On-demand/Scheduled|
|---|---|---|---|---|---|
|On-demand static|0|0|0|0|0|
|Scheduled static|1|0|0|0|1|
|On-demand dynamic census|2|0|0|1|0|
|Scheduled dynamic census|3|0|0|1|1|
|On-demand dynamic metadata|4|0|1|0|0|
|Scheduled dynamic metadata|5|0|1|0|1|
|On-demand dynamic|6|0|1|1|0|
|Scheduled dynamic|7|0|1|1|1|
|Encrypted on-demand static|8|1|0|0|0|
|Ecrypted scheduled static|9|1|0|0|1|
|Encrypted on-demand dynamic census|10|1|0|1|0|
|Encrypted Scheduled dynamic census|11|1|0|1|1|
|Encrypted on-demand dynamic metadata|12|1|1|0|0|
|Encrypted scheduled dynamic metadata|13|1|1|0|1|
|Encrypted dynamic on-demand|14|1|1|1|0|
|Encrypted dynamic scheduled|15|1|1|1|1|

An enum wrapper is available:

```typescript
import { ProcessMode } from "dvote-solidity"
// Flags
ProcessMode.SCHEDULED // => 1
ProcessMode.DYNAMIC_CENSUS // => 2
ProcessMode.DYNAMIC_METADATA // => 4
ProcessMode.ENCRYPTED_METADATA // => 8

// Also
const mode = ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: true, dynamicCensus: false, scheduled: true })
// => 13

// And also
const wrappedMode = new ProcessMode(mode)
wrappedMode.hasDynamicCensus // true
```

### Envelope types
Available flags:
- Single / multi envelope
- Public / anonymous voter
- Realtime / encrypted vote

Flag encoding:
```
0x00000111
       |||
       ||`- Realtime / encrypted vote
       |`- Public / anonymous voter
       `- Single / multi envelope
```

- `0` implies the first option
- `1` implies the second option

|Name|Value|Single/Multi envelope|Public/Anonymous voter|Realtime/Encrypted vote|
|---|---|---|---|---|
|Realtime Public Single (Open Poll)|0|0|0|0|
|Encrypted Public Single (Encrypted Poll)|1|0|0|1|
|Realtime Anonymous Single (Anonymous Poll)|2|0|1|0|
|Encrypted Anonymous Single (Election)|3|0|1|1|
|Realtime Public Multi-envelope (Realtime Assembly)|4|1|0|0|
|Encrypted Public Multi-envelope (Encrypted Assembly)|5|1|0|1|
|Realtime Anonymous Multi-envelope (Multi vote realtime election)|6|1|1|0|
|Encrypted Anonymous Multi-envelope (Multi vote election)|7|1|1|1|


An enum wrapper is available:

```typescript
import { ProcessEnvelopeType } from "dvote-solidity"
// Flags
ProcessEnvelopeType.ENCRYPTED_VOTES // => 1
ProcessEnvelopeType.ANONYMOUS_VOTERS // => 2
ProcessEnvelopeType.MULTI_ENVELOPE // => 4

// Also
const type = ProcessEnvelopeType.make({ multiEnvelope: true, anonymousVoters: false, encryptedVotes: true })
// => 5

// And also
const wrappedType = new ProcessEnvelopeType(type)
wrappedType.hasAnonymousVoters // false
```

### Process Status
The status of a process is defined in `status`. It is a simple enum, defined as follows:

- `ProcessStatus.OPEN // 0`
  - The process is open and Vochain nodes accept invoming votes
- `ProcessStatus.ENDED // 1`
  - The vochain will not accept any votes and the results should be available soon
- `ProcessStatus.CANCELED // 2`
  - The process has been canceled by the creator. No results will be published.
- `ProcessStatus.PAUSED // 3`
  - The process might be resumed in the future, but the Vochain is not processing any votes.

## Development

Compile and export the contracts ABI and Bytecode:
    `make all`

Run the test suite locally
    `make test`

### Current testing

Feel free to contribute any additional test cases that you consider necessary.

```mocha
  DVote Solidity
    EntityResolver
      ✓ Should deploy the contract (120ms)
      ✓ Should compute the ID of an entity by its address (223ms)
      Text Records
        ✓ Should set a Text record and keep the right value (210ms)
        ✓ Should override an existing Text record (130ms)
        ✓ Should reject updates from extraneous accounts (141ms)
        ✓ Should override the entity name (224ms)
        ✓ Should emit an event (96ms)
      Text List records
        ✓ Push a Text List record (267ms)
        ✓ Set a Text List record (398ms)
        ✓ Remove a Text List record (946ms)
        ✓ Should fail updating non-existing indexes (47ms)
        ✓ Should fail removing non-existing indexes (726ms)
        ✓ Should reject pushing values from extraneous accounts (59ms)
        ✓ Should reject setting values from extraneous accounts (297ms)
        ✓ Should emit events on push, update and remove (257ms)
    VotingProcess
      ✓ should deploy the contract (102ms)
      ✓ should compute a processId from the entity address and the process index (220ms)
      ✓ should compute the next processId (288ms)
      should set genesis
        ✓ only contract creator
        ✓ should persist (218ms)
        ✓ should emit an event (93ms)
      should set chainId
        ✓ only contract creator
        ✓ should persist (1593ms)
        ✓ should fail if duplicated
        ✓ should emit an event (85ms)
      should modify envelopeTypes
        ✓ should add an envelopeType (121ms)
        ✓ should remove an envelopeType (129ms)
        ✓ should only be modified by contract owner (40ms)
        ✓ should emit an event when added (69ms)
        ✓ should emit an event when removed (68ms)
      should create a process
        ✓ should allow anyone to create one (642ms)
        ✓ should emit an event (175ms)
        ✓ should increase the processCount of the entity on success (193ms)
        ✓ should not increase the processCount of the entity on error (56ms)
        ✓ retrieved metadata should match the one submitted (470ms)
      should modify process modes
        ✓ should add a mode (127ms)
        ✓ should remove a mode (124ms)
        ✓ should only be modified by contract owner (42ms)
        ✓ should emit an event when added (67ms)
        ✓ should emit an event when removed (66ms)
      should cancel the process
        ✓ only when the entity account requests it (609ms)
        ✓ if is not yet canceled (354ms)
        ✓ if it not yet ended (329ms)
        ✓ should emit an event (245ms)
      should end the process
        ✓ only when the entity account requests it (523ms)
        ✓ if is not yet ended (316ms)
        ✓ if it not canceled (393ms)
        ✓ should emit an event (243ms)
      should pause the process
        ✓ only if the entity account requests it (529ms)
        ✓ if not canceled (317ms)
        ✓ if not ended (332ms)
        ✓ if not paused yet (372ms)
        ✓ if opened (289ms)
        ✓ should emit an event (249ms)
      should open the process
        ✓ if not canceled (311ms)
        ✓ if not ended (334ms)
        ✓ if not opened yet (278ms)
        ✓ if paused (375ms)
      should handle assembly processes
        ✓ should create assembly processes (180ms)
        ✓ should have a default questionIndex (244ms)
        ✓ should increment questionIndex (1368ms)
      should register a validator
        ✓ only when the contract owner requests it (188ms)
        ✓ should add the validator public key to the validator list (197ms)
        ✓ should not add the validator public key to the validator list if exists (200ms)
        ✓ should emit an event (91ms)
      should remove a validator
        ✓ only when the contract owner account requests it (253ms)
        ✓ should fail if the idx does not match validatorPublicKey (127ms)
        ✓ should emit an event (199ms)
      should register an oracle
        ✓ only when the contract owner requests it (138ms)
        ✓ should add the oracle address to the oracle list (189ms)
        ✓ should not add the oracle address to the oracle list if exists (129ms)
        ✓ should emit an event (78ms)
      should remove an oracle
        ✓ only when the contract owner requests it (221ms)
        ✓ should fail if the idx is not valid (201ms)
        ✓ should fail if the idx does not match oracleAddress (202ms)
        ✓ should emit an event (161ms)
      should accept the results
        ✓ only when the sender is an oracle (451ms)
        ✓ only when the processId exists (115ms)
        ✓ only when the process is not canceled (412ms)
        ✓ should retrieve the submited results (343ms)
        ✓ should not publish twice (388ms)
        ✓ should emit an event (4327ms)
      enum wrappers
        ✓ should handle valid envelope types
        ✓ should fail on invalid envelope types
        ✓ should handle valid process modes
        ✓ should fail on invalid process modes
        ✓ should handle valid process status
        ✓ should fail on invalid process status


  88 passing (35s)
```

