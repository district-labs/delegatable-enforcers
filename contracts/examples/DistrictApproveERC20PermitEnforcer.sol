//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@district-labs/uniswap-oracle/contracts/interfaces/IDistrictUniswapV3Oracle.sol";
import { BytesLib } from "@delegatable/delegatable-sol/contracts/libraries/BytesLib.sol";
import { CaveatEnforcer, Transaction } from "@delegatable/delegatable-sol/contracts/CaveatEnforcer.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";

import "hardhat/console.sol";

contract DistrictApproveERC20PermitEnforcer is CaveatEnforcer {
  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash
  ) public override returns (bool) {
    bytes4 targetSig = bytes4(transaction.data[0:4]);
    bytes4 _allowedSig = 0x3e684702;
    require(targetSig == _allowedSig, "DistrictERC20SubscriptionsEnforcer:invalid-method");
    return true;
  }
}
