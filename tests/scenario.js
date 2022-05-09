/**
 * 1. ETH 價格為 1000U，WETH 價格為 1000U
 * 1. 所有 token 的抵押率皆為 80%
 * 1. 所有 token 的利率皆為 0
 * 1. 所有 token 的兌換率皆為 1:1
 * 1. Bob mint 100 cETH, 100 cWETH 到流動池
 * 1. Alice 抵押 100 ETH，得到 80 ETH 的 liquidity
 * 1. Alice 的 liquidity 相當於可借 80 WETH
 * 1. Alice 借出 70 WETH
 * 1. ETH 價格大跌，現在剩下 800U
 * 1. Alice 的 liquidity 變成是 64 WETH
 * 1. liquidator 向 aave 借出 70 WETH，對 compound 送出 liquidateBorrow
 * 1. liquidator 得到 100 cETH 獎勵，跟 compound 換成 ETH 之後，再度換成 WETH
 * 1. liquidator 將其中的 70 ETH + 手續費 還給 aave
 */
