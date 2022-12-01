//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@district-labs/uniswap-oracle/contracts/interfaces/IDistrictUniswapV3Oracle.sol";
import {BytesLib} from "../libraries/BytesLib.sol";
import "../CaveatEnforcer.sol";
import "hardhat/console.sol";

contract DistrictUniswapV3TwapAboveEnforcer is CaveatEnforcer {
    IDistrictUniswapV3Oracle public immutable oracle;

    constructor(IDistrictUniswapV3Oracle _oracle) {
        oracle = _oracle;
    }

    function getPoolArithmeticMeanTick(
        address _tokenA,
        address _tokenB,
        uint24 _fee,
        uint32 _secondsAgo
    ) public view returns (int24 arithmeticMeanTick) {
        arithmeticMeanTick = oracle.getPoolArithmeticMeanTick(
            _tokenA,
            _tokenB,
            _fee,
            _secondsAgo
        );
    }

    function enforceCaveat(
        bytes calldata terms,
        Transaction calldata transaction,
        bytes32 delegationHash
    ) public override returns (bool) {
        // 1. unpack the terms
        uint32 secondsAgo = BytesLib.toUint32(terms, 0);
        uint8 tickSign = BytesLib.toUint8(terms, 4);
        uint24 unsignedTickThreshold = BytesLib.toUint24(terms, 5); // next 8
        int24 tickThreshold;
        if (tickSign == 0) {
            // we ok with negatives due to MIN/MAX_TICK set by uni
            tickThreshold = -int24(unsignedTickThreshold);
        } else if (tickSign == 1) {
            tickThreshold = int24(unsignedTickThreshold);
        } else {
            revert(
                "DistrictUniswapV3TwapAboveEnforcer:tickSign MUST be 0 (negative), or 1 (positive)"
            );
        }
        address tokenA = BytesLib.toAddress(terms, 8);
        address tokenB = BytesLib.toAddress(terms, 28);
        uint24 fee = BytesLib.toUint24(terms, 48);
        // 2. get the price from uni
        int24 uniswapTwapTick = getPoolArithmeticMeanTick(
            tokenA,
            tokenB,
            fee,
            secondsAgo
        );

        if (tickThreshold > uniswapTwapTick) {
            return true;
        } else {
            revert(
                "DistrictUniswapV3TwapAboveEnforcer:tickThreshold <= uniswapTwapTick"
            );
        }
    }
}
