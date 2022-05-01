pragma solidity ^0.6.12;

abstract contract CErc20Delegator {
    function balanceOf(address owner) external view virtual returns (uint256);

    function liquidateBorrow(
        address borrower,
        uint256 repayAmount,
        address cTokenCollateral
    ) external virtual returns (uint256);
}

abstract contract CEther {
    function balanceOf(address owner) external view virtual returns (uint256);

    function redeem(uint256 redeemTokens) external virtual returns (uint256);
}
