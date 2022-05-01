pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CWETH is ERC20("cToken for wrapped ether", "cWETH") {
    constructor() {
        _mint(msg.sender, 1e25);
    }
}
