# DVote Solidity
This repo provides toolkit to interact with the EntityResolver and the VotingProcess smart contracts.

* Smart Contracts source code in Solidity
* JSON files with the contract ABI and the Bytecode of each
* Javascript file to import the JSON ABI and Bytecode

## Get started

Install NodeJS and NPM on your system.

```
npm install dvote-solidity
```

## Usage

From NodeJS, import the library:

```javascript
const { EntityResolver, VotingProcess } = require("dvote-js")

console.log(EntityResolver.abi, EntityResolver.bytecode)
console.log(VotingProcess.abi, VotingProcess.bytecode)

```

If you use Typescript, you may need to add `"resolveJsonModule": true` n your `tsconfig.json` file.

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
const ethers = require("ethers")
const config = ...

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../build/entity-resolver.json")
const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../build/voting-process.json")

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
    uint8 envelopeType;
    uint8 mode;
    address entityAddress;
    uint256 startBlock;
    uint256 numberOfBlocks;
    string metadata;
    string censusMerkleRoot;
    string censusMerkleTree;
    uint8 status;
    uint8 questionIndex;
    string results;
}
```

### Envelope Type
A voting process can have different types of envelopes. They are defined in `envelopeType` and they relate to:

- **Anonymous voters** (vs Known voter)
- **Encrypted vote** (until endBlock) (vs Plain vote)
- **Public metadata** (vs Private metadata)
- **Static census** (vs Dynamic census)

The following combinations are available:

| name | type | anonymous | encrypted vote | encrypted metadata | dynamic census | 
| ------ | ------ | ------ | ------ | ------ | ------ |
| (Realtime) Poll | 0000 = 0 | - | - | - | - |
| Petition Sign | 0001 = 1  | - | - | - | Yes |
| Encrypted Poll | 0100 = 4  | - | Yes | - | - |
| Encrypted Private Poll | 0110 = 6 | - | Yes | Yes | - |
| Realtime Election | 1000 = 8  | Yes | - | - | - |
| Realtime Private Election | 1010 = 10  | Yes | - | Yes | - |
| Election | 1100 = 12  | Yes | Yes | - | - |
| Private Election | 1110 = 14  | Yes | Yes | Yes | - |

An enum wrapper is available:

```typescript
import { ProcessEnvelopeType } from "dvote-solidity"
ProcessEnvelopeType.REALTIME_POLL // => 0
ProcessEnvelopeType.PETITION_SIGNING // => 1
ProcessEnvelopeType.ENCRYPTED_POLL // => 4
ProcessEnvelopeType.ENCRYPTED_PRIVATE_POLL // => 6
ProcessEnvelopeType.REALTIME_ELECTION // => 8
ProcessEnvelopeType.PRIVATE_ELECTION // => 10
ProcessEnvelopeType.ELECTION // => 12
ProcessEnvelopeType.REALTIME_PRIVATE_ELECTION // => 14

const myType = new ProcessEnvelopeType(ProcessEnvelopeType.REALTIME_POLL) // 0
myType.isRealtime() // true
```

### Process Mode
The behaviour of the process itself is defined by the `processMode`. The key flags are:

- **Scheduled** vs **On demand**
- **Assembly** vs **Single envelope**

| name | type | assembly | on demand |
| --- | --- | --- | --- |
| Scheduled | 00 = 0 | - | - |
| On demand single | 01 = 1 | - | Yes |
| Assembly | 11 = 3 | Yes | Yes |

An enum wrapper is available:

```typescript
import { ProcessMode } from "dvote-solidity"
ProcessMode.SCHEDULED_SINGLE // => 0
ProcessMode.ON_DEMAND_SINGLE // => 1
ProcessMode.ASSEMBLY // => 3

const myMode = new ProcessMode(ProcessMode.ASSEMBLY) // 3
myMode.isOnDemand() // true
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

Start a local blockchain:
    `npm run ganache`

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

