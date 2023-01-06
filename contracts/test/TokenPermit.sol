//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract TokenPermit is ERC20, ERC20Permit {
  constructor() ERC20("DistrictLabs", "DSTR") ERC20Permit("MyToken") {
    _mint(msg.sender, 100000 * 10 ** decimals());
  }
}
