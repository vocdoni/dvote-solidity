var VotingProcess = artifacts.require("VotingProcess")
const { increaseTimestamp } = require("./util-timestamp")

contract('VotingProcess', function (accounts) {

	const organizerAddress = accounts[0]
	const randomAddress = accounts[1]
	const relayAddress = accounts[2]

	it("should deploy the contract")

	it("should compute a process ID")

	it("should compute the next process ID")

	it("should allow anyone to create a process", () => {
		it("should enforce startTime's greater than the current timestamp")
		it("should enforce endTime's greater than the given startTime")
		it("retrieved metadata should match the one submitted")
		it("should increase the processCount of the entity on success")
		it("should not increase the processCount of the entity on error")
	})

	it("should cancel the process", () => {
		it("only when the entity requests it")
		it("only if it not yet canceled")
		it("not after startTime")
	})

	it("should register a relay", () => {
		it("only when the entity requests it")
		it("only when the process ID exists")
		it("only when the process is not canceled")
		it("should fail if it already exists")
		it("should add the relay address to the relay list")
		it("should return true on isActiveRelay")
	})

	it("should register a vote batch", () => {
		it("only when a registered relay submits it")
		it("only when the relay is active")
		it("only when the process ID exists")
		it("only when the process is not canceled")
		it("not before startTime")
		it("not after endTime")
		it("should increase the voteBatchCount on success")
		it("should not increase the voteBatchCount on error")
	})

	it("should disable a relay", () => {
		it("only when the entity requests it")
		it("only when the process ID exists")
		it("only when the process is not canceled")
		it("should fail if it does not exist")
		it("should remove the relay address from the relay list")
		it("should return false on isActiveRelay")
		it("should fail to register new vote batches from a disabled relay")
	})

	it("should accept the encryption private key", () => {
		it("only when the entity requests it")
		it("only when the process ID exists")
		it("only when the process is not canceled")
		it("only after endTime")
		it("only if the key matches the public key registered")
	})

})
