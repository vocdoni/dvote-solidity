// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "./base.sol"; // Base contracts (Chained, Owned)
import "./common.sol"; // Common interface for retro compatibility
import "./lib.sol"; // Helpers

contract Processes is IResultsStore {
    // GLOBAL DATA

    address public genesisAddress; // Address of the global genesis contract instance

    // DATA STRUCTS
    struct ProcessResults {
        uint32[][] tally; // The tally for every question, option and value
        uint32 height; // The amount of valid envelopes registered
        bool defined;
    }

    mapping(bytes32 => ProcessResults) internal results; // Mapping of all processes indexed by the Process ID

    // MODIFIERS

    /// @notice Fails if the msg.sender is not an authorired oracle
    modifier onlyOracle(uint32 vochainId) override {
        // Only an Oracle within the chainId is valid
        require(
            IGenesisStore(genesisAddress).isOracle(vochainId, msg.sender),
            "Not oracle"
        );
        _;
    }

    constructor(address genesisAddr) public {
        require(ContractSupport.isContract(genesisAddr), "Invalid genesisAddr");
        genesisAddress = genesisAddr;
    }

    // SETTERS

    function setResults(
        bytes32 processId,
        uint32[][] memory tally,
        uint32 height,
        uint32 vochainId
    ) public override onlyOracle(vochainId) {
        require(height > 0, "No votes");
        require(!results[processId].defined, "Already defined");

        // TODO: Check that the process on the processes contract exists and is not canceled

        // // cannot publish results on a canceled process or on a process
        // // that already has results
        // require(
        //     processes[processId].status != Status.CANCELED &&
        //         processes[processId].status != Status.RESULTS,
        //     "Canceled or already set"
        // );

        results[processId].tally = tally;
        results[processId].height = height;
        // processes[processId].status = Status.RESULTS;

        emit ResultsAvailable(processId);
    }

    // GETTERS

    /// @notice Fetch the results of the given processId, if any
    function getResults(bytes32 processId)
        public
        view
        override
        returns (uint32[][] memory tally, uint32 height)
    {
        if (!results[processId].defined) revert("Not found");

        // TODO: Check that the process exists on the processes contract

        // if (processes[processId].entity == address(0x0)) {
        //     // Not found locally
        //     if (predecessorAddress == address(0x0)) revert("Not found"); // No predecessor to ask

        //     // Ask the predecessor
        //     // Note: The predecessor's method needs to follow the old version's signature
        //     IProcessStore predecessor = IProcessStore(predecessorAddress);
        //     return predecessor.getResults(processId);
        // }

        return (results[processId].tally, results[processId].height);
    }
}
