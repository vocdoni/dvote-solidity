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
		it("retrieved metadata should match the one submitted")
	})

	it("should cancel the process", () => {
		it("only when the entity requests it")
		it("only if it not yet canceled")
		it("not after startTime")
	})

	it("should register a relay", () => {
		it("only when the entity requests it")
		it("only when the process not canceled")
		it("keep a list of addresses")
	})

	it("should disable a relay", () => {
		it("only when the entity requests it")
		it("only when the process not canceled")
	})

	it("should register a vote batch", () => {
		it("only when a registered relay submits it")
		it("only when the process not canceled")
		it("not before startTime")
		it("not after endTime")
	})

	it("should accept the encryption private key", () => {
		it("only when the entity requests it")
		it("only when the process not canceled")
		it("only after endTime")
		it("only if the key matches the public key registered")
	})

})
