//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@district-labs/uniswap-oracle/contracts/interfaces/IDistrictUniswapV3Oracle.sol";
import { BytesLib } from "@delegatable/delegatable-sol/contracts/libraries/BytesLib.sol";
import { CaveatEnforcer, Transaction } from "@delegatable/delegatable-sol/contracts/CaveatEnforcer.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";

import "hardhat/console.sol";

contract DistrictERC20PermitSubscriptionsEnforcer is CaveatEnforcer {
  mapping(bytes32 => uint64) public lastTimestamp;

  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash
  ) public override returns (bool) {
    bytes4 targetSig = bytes4(transaction.data[0:4]);
    bytes4 _allowedSig = 0x97e18d6e;
    require(targetSig == _allowedSig, "DistrictERC20SubscriptionsEnforcer:invalid-method");
    uint64 _subPeriod = BytesLib.toUint64(terms, 0);
    uint64 _currentTime = uint64(block.timestamp);
    require(
      lastTimestamp[delegationHash] + _subPeriod < _currentTime,
      "DistrictERC20SubscriptionsEnforcer:invalid-subscritpion-time"
    );
    lastTimestamp[delegationHash] = _currentTime;
    return true;
  }
}
