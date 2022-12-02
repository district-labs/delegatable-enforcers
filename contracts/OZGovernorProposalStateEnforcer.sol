//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/governance/IGovernor.sol";
import { BytesLib } from "@delegatable/delegatable-sol/contracts/libraries/BytesLib.sol";
import { CaveatEnforcer, Transaction } from "@delegatable/delegatable-sol/contracts/CaveatEnforcer.sol";

contract OZGovernorProposalStateEnforcer is CaveatEnforcer {
    function enforceCaveat(
        bytes calldata terms,
        Transaction calldata transaction,
        bytes32 delegationHash
    ) public override returns (bool) {
        address governor = BytesLib.toAddress(terms, 0);
        uint256 proposalId = BytesLib.toUint256(terms, 20);
        uint8 desiredState = BytesLib.toUint8(terms, 52);
        if (desiredState > 7) {
            revert("OZGovernorProposalStateEnforcer:desiredStatus infeasible, must be [0, 7]");
        }
        IGovernor.ProposalState proposalState = IGovernor(governor).state(proposalId);
        uint8 _proposalState = uint8(proposalState);
        if (desiredState == _proposalState) {
            return true;
        }
        else {
            revert("OZGovernorProposalStateEnforcer:desiredState not reached");
        }
    }


}