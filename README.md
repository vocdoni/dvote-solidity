# DVote Solidity
This repo provides toolkit to interact with the EntityResolver, the Process and the Namespace smart contracts.

* Smart Contracts source code in Solidity
* JSON files with the contract ABI and the Bytecode of each
* JS/Typescript support to import the JSON ABI and Bytecode

## Contracts

### Entity Resolver
The entity resolver is a flexible way to reference entities by their ethereum address or by the Entity ID (the hash of the address). It features the standard ENS implementation plus a specialized version of Text records that allows arrays.

It is currently used for its Text records, which store a link to the Entity Metadata on IPFS.

### Genesis

Acts as a registry where new Vocdoni chains are created. Each chain contains a Genesis, a list of Validators and a list of Oracles.

### Namespace

Acts as a registry where every process contract is registered when deployed. Each registered contract gets a unique namespace ID and so, contracts can use it to filter processes within a Vocdoni chain and also to prevent process ID collisions if several unrelated instances are running. 

### Process

In vocdoni, everything is a process, the main building block of any decentralized governance activity.

- Allows to set the details that define the vote
  - Human readable details (Metadata)
- Allows to control how the Vochain should handle the process
  - Who can vote (census origin, census root, census URI)
  - When they can vote (startBlock, blockCount, current status)
  - How ballots should be dealt with (envelopeType, uniqueValues, maxValue, costExponent, ...)
- Acts as the persistent source of truth

### Results

Serves as a registry where Oracles can publish the results of a process. A process contract is defined upon deployment, so that setting the results on a process, will set its status to `RESULTS` on the process contract (only if the sender is an Oracle on the related chain).

### Storage Proof

In order to run EVM census based elections, voters submit census Merkle Proofs that are checked against a certain block hash on the Ethereum blockchain. This contract is in charge of storing the ERC tokens available and validating the balance mapping position. 

### Base contracts

#### Chainable

It is quite likely that contracts like [process](#process) will need to be upgraded, while we also expect older data to remain available. 

Chainable is a base contract that allows defining predecessor instances and activate future instances succeeding the current one. Legacy data can be navigated to, pretty much as you would do on a MiniMe token contract. 

Contracts inheriting from Chainable can either:
- Have no predecessor and become active as soon as they are deployed
- Have a predecessor and start inactive by default

When a predecessor activates a successor
- The predecessor becomes inactive
- The successor becomes active

## Get started

[Install NodeJS](https://www.nodejs.org) and NPM on your system.

```
npm install dvote-solidity
```

## Usage

To import the ABI and the bytecode:

```javascript
const { EnsRegistry, EnsResolver, Genesis, Namespaces, Processes, Results, ERC20StorageProofs } = require("dvote-solidity")

console.log(EnsResolver.abi)
console.log(EnsResolver.bytecode)

console.log(Processes.abi)
console.log(Processes.bytecode)

...
```

If you use Typescript, you may need to add `"resolveJsonModule": true` in your `tsconfig.json` file.

Then use a client library to attach to an instance or deploy your own:

### Golang

Golang bindings for smart-contracts can be generated using `scripts/generate-contract-bindings.sh`. You will need the go-ethereum [`abigen`](https://github.com/ethereum/go-ethereum/tree/master/cmd/abigen).

### JavaScript (ethers.js)

```javascript
const { EnsRegistry, EnsResolver, Genesis, Namespaces, Processes, Results, ERC20StorageProofs } = require("dvote-solidity")
const ethers = require("ethers")
const config = { ... }

const { abi: ensResolverAbi, bytecode: ensResolverByteCode } = EnsResolver
const { abi: genesisAbi, bytecode: genesisByteCode } = Genesis
const { abi: namespacesAbi, bytecode: namespacesByteCode } = Namespaces
const { abi: processesAbi, bytecode: processesByteCode } = Processes
const { abi: resultsAbi, bytecode: resultsByteCode } = Results
const { abi: tokenStorageProofAbi, bytecode: tokenStorageProofByteCode } = TokenStorageProof
const { abi: namespaceAbi, bytecode: namespaceByteCode } = Namespace

const provider = new ethers.providers.JsonRpcProvider(config.GATEWAY_URL)

const privateKey = ethers.Wallet.fromMnemonic(config.MNEMONIC).privateKey
const address = await ethers.Wallet.fromMnemonic(config.MNEMONIC).getAddress()

const wallet = new ethers.Wallet(privateKey, provider);

// deploying
const resolverFactory = new ethers.ContractFactory(ensResolverAbi, ensResolverByteCode, wallet)
const genesisFactory = new ethers.ContractFactory(genesisAbi, genesisByteCode, wallet)
const namespacesFactory = new ethers.ContractFactory(namespacesAbi, namespacesByteCode, wallet)
const processesFactory = new ethers.ContractFactory(processesAbi, processesByteCode, wallet)
const resultsFactory = new ethers.ContractFactory(resultsAbi, resultsByteCode, wallet)
const tokenStorageProofFactory = new ethers.ContractFactory(tokenStorageProofAbi, tokenStorageProofByteCode, wallet)

const resolverInstance = await resolverFactory.deploy()
console.log("Resolver deployed at", resolverInstance.address)

const tokenStorageProofInstance = await tokenStorageProofFactory.deploy()
console.log("Token Storage Proof deployed at", tokenStorageProofInstance.address)

const namespacesInstance = await namespacesFactory.deploy()
console.log("Namespace deployed at", namespacesInstance.address)

const chainId = 0
const processPrice = 0

// The process contract needs the address of an already deployed namespaces instance
const predecessorInstanceAddress = "0x0000000000000000000000000000000000000000" // No predecessor
const processInstance = await processFactory.deploy(predecessorInstanceAddress, namespacesInstance.address, resultsInstance.address, tokenStorageProofInstance.address, chainId, processPrice)
console.log("Processes deployed at", processInstance.address)

// or attaching
const ensResolver = new ethers.Contract(ensResolverAddress, ensResolverAbi, wallet)
const processes = new ethers.Contract(processAddress, processAbi, wallet)
const tokenStorageProof = new ethers.Contract(tokenStorageProofAddress, tokenStorageProofAbi, wallet)
const namespaces = new ethers.Contract(namespacesAddress, namespacesAbi, wallet)

const tx1 = await ensResolver.setText(...)
await tx1.wait()
const tx2 = await processes.newProcess(...)
await tx2.wait()
const tx3 = await genesis.addOracle(...)
await tx3.wait()
```

## Types and values

A Voting Process is defined by the following fields within the contract:

```solidity
struct Process {
  uint8 mode; // The selected process mode. See: https://vocdoni.io/docs/#/architecture/smart-contracts/process?id=flags
  uint8 envelopeType; // One of valid envelope types, see: https://vocdoni.io/docs/#/architecture/smart-contracts/process?id=flags
  uint8 questionIndex; // The index of the currently active question (only assembly processes)
  // How many questions are available to vote
  // questionCount >= 1
  uint8 questionCount;
  // How many choices can be made for each question.
  // 1 <= maxCount <= 100
  uint8 maxCount;
  // Determines the acceptable value range.
  // N => valid votes will range from 0 to N (inclusive)
  uint8 maxValue;
  uint8 maxVoteOverwrites; // How many times a vote can be replaced (only the last one counts)
  CensusOrigin censusOrigin; // How the census proofs are computed (Off-chain vs EVM Merkle Tree)
  Status status; // One of 0 [ready], 1 [ended], 2 [canceled], 3 [paused], 4 [results]
  // Limits up to how much cost, the values of a vote can add up to (if applicable).
  // 0 => No limit / Not applicable
  uint16 maxTotalCost;
  // Defines the exponent that will be used to compute the "cost" of the options voted and compare it against `maxTotalCost`.
  // totalCost = Σ (value[i] ** costExponent) <= maxTotalCost
  //
  // Exponent range:
  // - 0 => 0.0000
  // - 10000 => 1.0000
  // - 65535 => 6.5535
  uint16 costExponent;
  uint32 startBlock; // Vochain block number on which the voting process starts
  uint32 blockCount; // Amount of Vochain blocks during which the voting process should be active
  address entity; // The address of the Entity (or contract) holding the process
  address owner; // Creator of a process on behalf of the entity
  uint256 sourceBlockHeight; // Source block number to use as a snapshot for the on-chain census
  bytes32 paramsSignature; // entity.sign({...}) // fields that the oracle uses to authentify process creation
  string metadata; // Content Hashed URI of the JSON meta data (See Data Origins)
  string censusRoot; // Hex string with the Census Root. Depending on the census origin, it will be a Merkle Root or a public key.
  string censusUri; // Content Hashed URI of the exported Merkle Tree (not including the public keys)
}
```

Behaviour is defined by the flags on these variables:
- `mode`
  - The process mode (how it behaves)
- `envelopeType`
  - How votes look like
- `censusOrigin`
  - What kind of census proof needs to be used
- `status`
  - Whether the process is open, ended, canceled, paused, results

## Process Mode

The process mode affects both the Vochain, the contract itself and even the metadata.

```
0b00011111
     |||||
     ||||`- autoStart
     |||`-- interruptible
     ||`--- dynamicCensus
     |`---- encryptedMetadata
     `----- preregister
```

### autoStart

- `false` ⇒ Needs to be set to `READY` by the creator. Starts `PAUSED` by default.
- `true` ⇒ Will start by itself at block `startBlock`.

`newProcess()` enforces `startBlock` > 0 accordingly

### interruptible

- `false` ⇒ Only the Vochain can `END` the process at block `startBlock + blockCount`
- `true` ⇒ In addition to the above, the admin can `END`, `PAUSE` and `CANCEL`
    - Pausing a process prevents votes from being received, `blockCount` stays unchanged by now

### dynamicCensus

- `false` ⇒ Census is immutable
- `true` ⇒ Census can be edited during the life-cycle of the process. Allowing to add, subtract new keys, or change the census entirely, to a process that has already started.
    - Intended for long-term polls
    - Warning: The admin has the opportunity to obscurely cheat by enabling keys and then removing them

### encryptedMetadata

- `false` ⇒ The processMetadata is in plain text
- `true` ⇒ The questions and options of a process will be encrypted, so an observer of the network won't be able to see what the process is about unless it has the key.

It requires a prior process to share the encryption key with the users that will have the rights to read the data. This will be likely be handled by the `User Registry`

### preregister

- `false` ⇒ Eligible voters can vote right away. As long as they are part of the census, the vote will be casted by signing the envelope. No need to preregister a derived key for anonymous voting. Set this flag to false when anonymous voting is not required.
- `true` ⇒ Eligible voters need to use a login (ECDSA) key to register a ZK-Snark friendly key before the process starts. The new key will be used when casting the actual vote.

### JavaScript wrapper

A JavaScript wrapper is available for convenience

```typescript
import { ProcessMode } from "dvote-solidity"
// Flags
ProcessMode.AUTO_START // => 1
ProcessMode.INTERRUPTIBLE // => 2
ProcessMode.DYNAMIC_CENSUS // => 4
ProcessMode.ENCRYPTED_METADATA // => 8
ProcessMode.PREREGISTER // => 16

// Also
mode = ProcessMode.make({})
// => 0
mode = ProcessMode.make({ autoStart: false, interruptible: false, dynamicCensus: false, encryptedMetadata: false })
// => 0
mode = ProcessMode.make({ autoStart: true, interruptible: true, dynamicCensus: true, encryptedMetadata: true, preregister: true })
// => 31

// And also
const pMode = new ProcessMode(31)
pMode.isAutoStart // true
pMode.isInterruptible // true
pMode.hasDynamicCensus // true
pMode.hasEncryptedMetadata // true
pMode.hasPreregister // true
```

## Envelope Type

The envelope type tells how the vote envelope is formatted and handled. Its value is generated by combining the flags below.

```
0b00011111
     |||||
     ||||`- serial
     |||`-- anonymous
     ||`--- encryptedVote
     |`---- uniqueValues
     `----- costFromWeight
```

### serial

- `false` A single envelope is expected with all votes in it
- `true` An envelope needs to be sent for each question, as `questionIndex` increases

### anonymous

- `false` The voter identity (public key) can be known and therefore, the vote is pseudonymous. If an observer can correlate the voter public key with personal data, the voter could be identified.
- `true` The voter public key can't be known. Instead, the voter will submit a ZK-snark proof, ensuring that:
  - He/she belongs to the census of the process
  - He/she has not already voted on the process

### encryptedVote

- `false` Votes are sent in plain text. Results can be seen in real time.
- `true` The vote payload will be encrypted. The results will become available once the encryption key is published at the end of the process by the miners.

### uniqueValues

- `false` The same choice can be made twice or more, as long as maxTotalCost is held.
- `true` Choices for a question cannot appear twice or more.

### costFromWeight

- `true` On EVM-based census processes (weighted), the user's balance will be used as the maxCost. This allows splitting the voting power among several choices, even including quadratic voting scenarios.
- `false` The max cost will be taken from the value on the smart contract, being the same for everyone.
### JavaScript wrapper

A JavaScript wrapper is available for convenience

```typescript
import { ProcessEnvelopeType } from "dvote-solidity"
// Flags
ProcessEnvelopeType.SERIAL // => 1
ProcessEnvelopeType.ANONYMOUS // => 2
ProcessEnvelopeType.ENCRYPTED_VOTES // => 4
ProcessEnvelopeType.UNIQUE_VALUES // => 8
ProcessEnvelopeType.COST_FROM_WEIGHT // => 16

// Also
type = ProcessEnvelopeType.make({})
// => 0
type = ProcessEnvelopeType.make({ serial: false, anonymousVoters: false, encryptedVotes: false, uniqueValues: false })
// => 0
type = ProcessEnvelopeType.make({ serial: true, anonymousVoters: true, encryptedVotes: true, uniqueValues: true })
// => 15
type = ProcessEnvelopeType.make({ serial: true, anonymousVoters: true, encryptedVotes: true, uniqueValues: true })
// => 31
type = ProcessEnvelopeType.make({ serial: true, anonymousVoters: true, encryptedVotes: true, uniqueValues: true, costFromWeight: true })

// And also
const pEnvType = new ProcessEnvelopeType(31)
pEnvType.hasSerialVoting // true
pEnvType.hasAnonymousVoters // true
pEnvType.hasEncryptedVotes // true
pEnvType.hasUniqueValues // true
pEnvType.hasCostFromWeight // true
```

## Process Status
The status of a process is a simple enum, defined as follows:

- `READY` (0)
  - The process is marked as ready. It is intended as a **passive authorization** to open the process
  - Vochain nodes will accept incoming votes if `AUTO_START` is disabled
  - Otherwise, they will accept votes when the Vochain block number reaches `startBlock`
- `ENDED` (1)
  - Tells the Vochain to stop accepting votes and start computing the results (if not already available)
  - Only when `INTERRUPTIBLE` is set
- `CANCELED` (2)
  - Tells the Vochain to stop accepting votes and drop the existing data. No results will be published.
  - Only when `INTERRUPTIBLE` is set
- `PAUSED` (3)
  - Tells the Vochain to stop processing votes temporarily. The process might be resumed in the future.
  - Only when `INTERRUPTIBLE` is set, or right after creation if `AUTO_START` is not set
- `RESULTS` (4)
  - Set by the Oracle as soon as the results of a process have become available

## Development

Compile and export the contracts ABI and Bytecode:
    `make all`

Run the test suite locally
    `make test`

On Linux, you may need to remove `package-lock.json` and try again.

## Deployments

See `scripts/deploy.ts` to deploy your own version. Copy `config.yaml.template` into `config.yaml` and set your own values.

### xDAI

- ENS registry:
  - Address: `0x00cEBf9E1E81D3CC17fbA0a49306EBA77a8F26cD`
- Domains:
  - Production
    - `entities.voc.eth`
    - `genesis.voc.eth`
    - `namespaces.voc.eth`
    - `processes.voc.eth`
    - `results.voc.eth`
    - `erc20.proofs.voc.eth`
  - Staging
    - `entities.stg.voc.eth`
    - `genesis.stg.voc.eth`
    - `namespaces.stg.voc.eth`
    - `processes.stg.voc.eth`
    - `results.stg.voc.eth`
    - `erc20.proofs.stg.voc.eth`
  - Development
    - `entities.dev.voc.eth`
    - `genesis.dev.voc.eth`
    - `namespaces.dev.voc.eth`
    - `processes.dev.voc.eth`
    - `results.dev.voc.eth`
    - `erc20.proofs.dev.voc.eth`

<!--
### Sokol

- ENS Registry: 
  - Address: `0xDb6C74071116D17a47D9c191cbE6d640111Ee5C2`
- ENS Resolver:
  - Address: `0xf3c50b2f86C0FC53e06CeaB88236BB404c3F2F9d`
  - Domain: `entities.voc.eth`
- Process:
  - Address: `0xd92D591322A2375C1F010DF36FFC23257c71a418`
  - Domain: `processes.voc.eth`
  - Predecessor: `0x0000000000000000000000000000000000000000`
- Token Storage Proofs:
  - ERC20
    - Address: `0xeA2bafa402AbDF2888eB23224df998FaF8AA79a8`
    - Domain: `erc20.proofs.voc.eth`
- Namespace:
  - Address: `0xC9d39F57a14FadA742c69FF7EDaB2C965e933921`
  - Domain: `namespaces.voc.eth`
-->

### Polygon (prod)
- ENS registry:
  - Address: `0xffe6ef08Eb7770837b3bBBE04e67eE25cC19a12a`
- ENS Public resolver
  - Address: `0x833F1975C107cbd7D08F97A483994E8F4c113207`
- Domains:
  - `entities.voc.eth`  (`0x1811cd36A7fccc53f76F0a724C7697e8a70Ad43b`)
  - `processes.voc.eth`  (`0x322488d666C581373739c479Fdbb694c0297272D`)
  - `erc20.proofs.voc.eth`  (`0x388b89E2326F6a4adF2D0D438DEe9015DF557B32`)
  - `genesis.voc.eth`  (`0xbAF5616856c327d35314D6E0738981d9d01ee6EC`)
  - `namespaces.voc.eth`  (`0x30eaA57E289D68E4C25da9b0138b11646618D5C9`)
  - `results.voc.eth`  (`0x5eE6fe3EEc9b40B869C46ca69e839b5b5C268876`)

### Polygon (stg)

- ENS registry:
  - Address: `0xffe6ef08Eb7770837b3bBBE04e67eE25cC19a12a`
- ENS Public resolver
  - Address: `0x833F1975C107cbd7D08F97A483994E8F4c113207`
- Domains:
  - `entities.stg.voc.eth`  (`0xE1e2B048a79a9129A3C9115a4659E5CCE0ece366`)
  - `processes.stg.voc.eth`  (`0xce0E8B7C2bd3817975D0cD3155aCdB1Ae6D57906`)
  - `erc20.proofs.stg.voc.eth`  (`0x8075f1000220562aEac67a829FD14C437f592A31`)
  - `genesis.stg.voc.eth`  (`0xF3Eb1C4f1F8a5F1e3e3f81602c48Ebb3F9C10685`)
  - `namespaces.stg.voc.eth`  (`0x4da3E0Ac6ADa94726827E04b76a3333F495a584D`)
  - `results.stg.voc.eth`  (`0x6aEbd4562Cadc57641F62bA8AB24811dACadfae0`)

### Polygon (dev)
- ENS registry:
  - Address: `0xffe6ef08Eb7770837b3bBBE04e67eE25cC19a12a`
- ENS Public resolver
  - Address: `0x833F1975C107cbd7D08F97A483994E8F4c113207`
- Domains:
  - `entities.dev.voc.eth`  (`0x3A86BD70443b419EeaD0B458D3d044011Ad8265A`)
  - `processes.dev.voc.eth`  (`0xa0B762F2Db3A4C0D627B43382a93c458FE774bd9`)
  - `erc20.proofs.dev.voc.eth`  (`0x163Cc7Dfb9368bAB4eC0BfF8C8Bf4b3Bd4b230de`)
  - `genesis.dev.voc.eth`  (`0x8A5332db5b20e74d8295f9ebDEAF6483d2F079c4`)
  - `namespaces.dev.voc.eth`  (`0x808fe9864347fdCa4693aB91FAe85BaaC1eB0432`)
  - `results.dev.voc.eth`  (`0x9132ed31fBE729666e5A14B6A637d9E2f80dC383`)

### Goerli

- ENS registry:
  - Address: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- ENS public resolver:
  - Address: `0x4B1488B7a6B320d2D721406204aBc3eeAa9AD329`
- Domains:
  - Development
    - `entities.dev.voc.eth`
    - `genesis.dev.voc.eth`
    - `namespaces.dev.voc.eth`
    - `processes.dev.voc.eth`
    - `results.dev.voc.eth`
    - `erc20.proofs.dev.voc.eth`
