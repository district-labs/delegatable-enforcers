//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import { BytesLib } from "@delegatable/delegatable-sol/contracts/libraries/BytesLib.sol";
import { CaveatEnforcer, Transaction } from "@delegatable/delegatable-sol/contracts/CaveatEnforcer.sol";

contract DistrictChainlinkAggregatorV3PriceBelowEnforcer is CaveatEnforcer {
  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash
  ) public override returns (bool) {
    address chainlinkPriceFeed = BytesLib.toAddress(terms, 0);
    uint8 priceThresholdSign = BytesLib.toUint8(terms, 20);
    uint256 unsignedPriceThreshold = BytesLib.toUint256(terms, 21);
    int256 priceThreshold;
    if (priceThresholdSign == 0) {
      priceThreshold = -int256(unsignedPriceThreshold);
    } else if (priceThresholdSign == 1) {
      priceThreshold = int256(unsignedPriceThreshold);
    } else {
      revert(
        "DistrictChainlinkAggregatorV3PriceBelowEnforcer:priceThreshold MUST be 0 (negative), or 1 (positive)"
      );
    }
    (, int256 chainlinkPrice, , , ) = AggregatorV3Interface(chainlinkPriceFeed).latestRoundData();
    if (priceThreshold < chainlinkPrice) {
      return true;
    } else {
      revert("DistrictChainlinkAggregatorV3PriceBelowEnforcer:priceThreshold >= chainlinkPrice");
    }
  }
}
