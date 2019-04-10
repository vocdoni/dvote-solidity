# DVote Solidity
This repo provides toolkit to interact with the EntityResolver and the VotingProcess smart contracts.

* Smart Contracts source code in Solidity
* JSON files with the contract ABI and the Bytecode of each
* Javascript file to import the JSON ABI and Bytecode

## Get started

Use `npm` or `yarn` to install the package:

```
npm install dvote-js
```

## Usage

From NodeJS, import the library:

```javascript
const { EntityResolver, VotingProcess } = require("dvote-js")

console.log(EntityResolver.abi, EntityResolver.bytecode)
console.log(VotingProcess.abi, VotingProcess.bytecode)

```

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

### Etherejs

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

const processInstance = await processFactory.deploy()
console.log(processInstance.address)

// or attaching
const resolver = new ethers.Contract(resolverAddress, entityResolverAbi, wallet);
const process = new ethers.Contract(processAddress, votingProcessAbi, wallet);

const tx = await resolver.setText(...)
const tx = await process.create(...)

```

## Development

Compile and export the contracts ABI and Bytecode:
    `npm run build`

Start a local blockchain:
    `npm run ganache`

Run the test suite locally
    `npm test`

### Current testing

Feel free to contribute any additional test cases that you consider necessary.

```mocha
  DVote Solidity
    EntityResolver
      ✓ Should deploy the contract (75ms)
      Text Records
        ✓ Should set a Text record and keep the right value (220ms)
        ✓ Should override an existing Text record (166ms)
        ✓ Should reject updates from extraneous accounts (340ms)
        ✓ Should override the entity name (311ms)
        ✓ Should emit an event (165ms)
      Text List records
        ✓ Push a Text List record (387ms)
        ✓ Set a Text List record (393ms)
        ✓ Remove a Text List record (924ms)
        ✓ Should fail updating non-existing indexes (149ms)
        ✓ Should fail removing non-existing indexes (838ms)
        ✓ Should reject pushing values from extraneous accounts (95ms)
        ✓ Should reject setting values from extraneous accounts (369ms)
        ✓ Should emit events on push, update and remove (275ms)
    VotingProcess
      ✓ should deploy the contract (63ms)
      ✓ should compute a processId from the entity address and the process index (114ms)
      ✓ should compute the next processId (241ms)
      should create a process
        ✓ should allow anyone to create one (458ms)
        ✓ should emit an event (162ms)
        ✓ should enforce startTime's greater than the current timestamp (90ms)
        ✓ should enforce endTime's greater than the given startTime (157ms)
        ✓ should increase the processCount of the entity on success (149ms)
        ✓ should not increase the processCount of the entity on error (112ms)
        ✓ retrieved metadata should match the one submitted (282ms)
      should cancel the process
        ✓ only when the creator requests it (516ms)
        ✓ only if it not yet canceled (346ms)
        ✓ not after startTime (4216ms)
        ✓ should emit an event (214ms)
        ✓ should return an empty relay list after a process is canceled (374ms)
      should register a relay
        ✓ only when the creator requests it (418ms)
        ✓ only when the processId exists (71ms)
        ✓ only when the process is not canceled (433ms)
        ✓ should fail if it already exists as active (396ms)
        ✓ should add the relay address to the relay list (351ms)
        ✓ should return true on isActiveRelay (263ms)
        ✓ should retrieve a given relay's data (249ms)
        ✓ should emit an event (213ms)
      should register a vote batch
        ✓ only when a registered relay submits it (3442ms)
        ✓ only when the relay is active (2759ms)
        ✓ only when the processId exists (138ms)
        ✓ only when the process is not canceled (3433ms)
        ✓ not before startTime (1436ms)
        ✓ not after endTime (4906ms)
        ✓ should increase the voteBatchCount on success (3449ms)
        ✓ should not increase the voteBatchCount on error (5118ms)
        ✓ should retrieve the vote batches submitted in ascending order (3679ms)
        ✓ should emit an event (2622ms)
      should disable a relay
        ✓ only when the creator requests it (390ms)
        ✓ only when the processId exists (68ms)
        ✓ only when the process is not canceled (362ms)
        ✓ should fail if the relay does not exist (288ms)
        ✓ should remove the relay address from the relay list (507ms)
        ✓ should return false on isActiveRelay (396ms)
        ✓ should fail to register new vote batches from a disabled relay (2741ms)
        ✓ should emit an event (313ms)
      should accept the encryption private key
        ✓ only when the creator requests it (5194ms)
        ✓ only when the processId exists (70ms)
        ✓ only when the process is not canceled (4273ms)
        ✓ only after endTime (2644ms)
        ✓ should retrieve the submited private key (4322ms)
        - only if the key matches the public key registered
        ✓ should overwrite it in case of a mistake (4411ms)
        ✓ should emit an event (4207ms)


  62 passing (1m)
  1 pending

```

