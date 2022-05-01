const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const { accounts, wethAddress } = require('../constant');

const AliceAccount = accounts[0].address;
const BobAccount = accounts[1].address;
const liquidatorAccount = accounts[2].address;

/** mint amounts */
const aliceCEtherMintAmount = ethers.utils.parseEther('100');
const aliceWETHDepositAmount = ethers.utils.parseEther('100');
const aliceCWETHBorrowAmount = ethers.utils.parseEther('70');
const bobCEtherMintAmount = ethers.utils.parseEther('100');
const bobWETHDepositAmount = ethers.utils.parseEther('100');
const bobCWETHMintAmount = ethers.utils.parseEther('90');

/** comptroller parameters */
const liquidationIncentive = ethers.utils.parseEther('1');
const closeFactor = ethers.utils.parseEther('0.5');
const maxAssets = 12;

/** cEther parameters */
const cEtherExchangeRate = ethers.utils.parseEther('1');
const cEtherCollateralFactor = ethers.utils.parseEther('0.9');

/** cWETH parameters */
const cWETHExchangeRate = ethers.utils.parseEther('1');
const cWETHCollateralFactor = ethers.utils.parseEther('0.75');

const f = (number) => {
  return ethers.utils.formatEther(number, { commify: true, pad: false });
};

const deployComptroller = async () => {
  const Comptroller = await ethers.getContractFactory('ComptrollerG1');
  const comptroller = await Comptroller.deploy();
  await comptroller.deployed();
  return comptroller;
};

const deployInterestRateModel = async () => {
  const InterestRateModel = await ethers.getContractFactory(
    'WhitePaperInterestRateModel'
  );
  const interestRateModel = await InterestRateModel.deploy(0, 0);
  await interestRateModel.deployed();
  return interestRateModel;
};

const deployCEther = async (comptrollerAddress, interestRateModelAddress) => {
  const CEther = await ethers.getContractFactory('CEther');
  const cEther = await CEther.deploy(
    comptrollerAddress,
    interestRateModelAddress,
    cEtherExchangeRate,
    'CEther',
    'cETH',
    18,
    AliceAccount
  );
  await cEther.deployed();
  return cEther;
};

const deployOracle = async () => {
  const Oracle = await ethers.getContractFactory('SimplePriceOracle');
  const oracle = await Oracle.deploy();
  await oracle.deployed();
  return oracle;
};

const attachWETH = async () => {
  const WETH = await ethers.getContractFactory('WETH9');
  const weth = WETH.attach(wethAddress);
  return weth;
};

const deployDelegate = async () => {
  const ERCDelegate = await ethers.getContractFactory('CErc20Delegate');
  const delegate = await ERCDelegate.deploy();
  await delegate.deployed();
  return delegate;
};

const deployDelegator = async (
  wethAddress,
  comptrollerAddress,
  interestRateModelAddress,
  adminAddress,
  delegateAddress
) => {
  const ERCDelegator = await ethers.getContractFactory('CErc20Delegator');
  const delegator = await ERCDelegator.deploy(
    wethAddress,
    comptrollerAddress,
    interestRateModelAddress,
    cWETHExchangeRate,
    'a cToken for wrapped ether',
    'cWETH',
    1,
    adminAddress,
    delegateAddress,
    0x00
  );
  await delegator.deployed();
  return delegator;
};

describe('compound practice', async () => {
  let comptroller;
  let interestRateModel;
  let cEther;
  let oracle;
  let weth;
  let delegate;
  let delegator;
  let secondUser;
  let cEtherForSecondUser;
  let wethForSecondUser;
  let cWETHForSecondUser;
  let comptrollerForSecondUser;

  before(async () => {
    comptroller = await deployComptroller();
    interestRateModel = await deployInterestRateModel();
    cEther = await deployCEther(comptroller.address, interestRateModel.address);
    oracle = await deployOracle();
    weth = await attachWETH();
    delegate = await deployDelegate();
    delegator = await deployDelegator(
      weth.address,
      comptroller.address,
      interestRateModel.address,
      AliceAccount,
      delegate.address
    );
    await comptroller._setCloseFactor(closeFactor);
    await comptroller._setPriceOracle(oracle.address);
    await comptroller._setMaxAssets(maxAssets);
    await comptroller._setLiquidationIncentive(liquidationIncentive);

    secondUser = await ethers.getSigner(BobAccount);
    cEtherForSecondUser = await ethers.getContractAt(
      'CEther',
      cEther.address,
      secondUser
    );
    wethForSecondUser = await ethers.getContractAt(
      'WETH9',
      weth.address,
      secondUser
    );
    cWETHForSecondUser = await ethers.getContractAt(
      'CErc20Delegator',
      delegator.address,
      secondUser
    );
    comptrollerForSecondUser = await ethers.getContractAt(
      'ComptrollerG1',
      comptroller.address,
      secondUser
    );
  });

  describe('oracle should have price', async () => {
    it('should set underlying price to cEther', async () => {
      const price = await oracle.getEtherPrice();
      const actualEtherPrice = ethers.utils.parseEther(price.toString());
      await oracle.setUnderlyingPrice(cEther.address, actualEtherPrice);

      const cEtherPrice = await oracle.getUnderlyingPrice(cEther.address);
      expect(cEtherPrice.eq(actualEtherPrice)).to.be.true;
    });

    it('should set underlying price of cWETH as 1/10 to cEther ', async () => {
      const cEtherPrice = await oracle.getUnderlyingPrice(cEther.address);
      await oracle.setUnderlyingPrice(delegator.address, cEtherPrice.div(10));

      const wethPrice = await oracle.getUnderlyingPrice(delegator.address);
      expect(wethPrice.eq(cEtherPrice.div(10))).to.be.true;
    });
  });

  describe('should successFully deployed', async () => {
    it('should deploy Comptroller', async () => {
      expect(comptroller.address).to.be.a('string');
    });
    it('should deploy InterestRateModel', async () => {
      expect(interestRateModel.address).to.be.a('string');
    });
    it('should deploy CEther', async () => {
      expect(cEther.address).to.be.a('string');
    });
    it('should deploy Oracle', async () => {
      expect(oracle.address).to.be.a('string');
    });
    it('should attach WETH', async () => {
      expect(weth.address).to.be.a('string');
    });
    it('should deploy Delegate', async () => {
      expect(delegate.address).to.be.a('string');
    });
    it('should deploy Delegator', async () => {
      expect(delegator.address).to.be.a('string');
    });
  });

  describe('comptroller should support market CEther and CWETH', async () => {
    before(async () => {
      cEtherError = await (
        await comptroller._supportMarket(cEther.address)
      ).wait();
      cWETHError = await (
        await comptroller._supportMarket(delegator.address)
      ).wait();
    });

    it('should support markets CEther and CWETH', async () => {
      let cEtherMarket = await comptroller.markets(cEther.address);
      let cWETHMarket = await comptroller.markets(delegator.address);

      expect(cEtherMarket.isListed).to.be.true;
      expect(cWETHMarket.isListed).to.be.true;
    });
  });

  describe('comptroller should set collateral factor to CEther and CWETH', async () => {
    it('should set collateral factor', async () => {
      await comptroller._setCollateralFactor(
        cEther.address,
        cEtherCollateralFactor
      );

      await comptroller._setCollateralFactor(
        delegator.address,
        cWETHCollateralFactor
      );

      const cEtherMarket = await comptroller.markets(cEther.address);
      const cWETHMarket = await comptroller.markets(delegator.address);

      expect(cEtherMarket.collateralFactorMantissa.eq(cEtherCollateralFactor))
        .to.be.true;
      expect(cWETHMarket.collateralFactorMantissa.eq(cWETHCollateralFactor)).to
        .be.true;
    });
  });

  describe(`Bob should mint cETH and cWETH and liquidate the pool`, async () => {
    it('the cEther mint event should be successful', async () => {
      const balance = await cEtherForSecondUser.balanceOf(BobAccount);

      await cEtherForSecondUser.mint({
        value: bobCEtherMintAmount.toString(),
      });
      const balanceNew = await cEtherForSecondUser.balanceOf(BobAccount);

      expect(
        balanceNew.eq(
          balance.add(
            ethers.utils.parseEther(
              bobCEtherMintAmount.div(cEtherExchangeRate).toString()
            )
          )
        )
      ).to.be.true;
    });

    it('this cWETH mint event should be successful', async () => {
      await wethForSecondUser.deposit({ value: bobCWETHMintAmount.toString() });
      await wethForSecondUser.approve(
        cWETHForSecondUser.address,
        bobCWETHMintAmount
      );
      const balance = await cWETHForSecondUser.balanceOf(BobAccount);

      await cWETHForSecondUser.mint(bobCWETHMintAmount);

      const balanceNew = await cWETHForSecondUser.balanceOf(BobAccount);

      expect(
        balanceNew.eq(
          balance.add(
            ethers.utils.parseEther(
              bobCWETHMintAmount.div(cWETHExchangeRate).toString()
            )
          )
        )
      ).to.be.true;
    });

    it('should be able to enter market', async () => {
      await comptrollerForSecondUser.enterMarkets([
        cEtherForSecondUser.address,
        cWETHForSecondUser.address,
      ]);
      const assetsInPool = await comptrollerForSecondUser.getAssetsIn(
        secondUser.address
      );
      expect(assetsInPool)
        .to.contain(cEther.address)
        .and.contain(delegator.address);
    });
  });

  describe(`Alice stake cEther for some cWETH`, async () => {
    before(async () => {
      await cEther.mint({ value: aliceCEtherMintAmount.toString() });
    });

    it(`should have cEther balance: ${aliceCEtherMintAmount}`, async () => {
      const balance = await cEther.balanceOf(AliceAccount);
      expect(balance.eq(aliceCEtherMintAmount)).to.be.true;
    });

    it(`should enter market`, async () => {
      const resultRaw = await comptroller.enterMarkets([
        cEther.address,
        delegator.address,
      ]);
      await resultRaw.wait();

      const assetsOfUser = await comptroller.getAssetsIn(AliceAccount);
      expect(assetsOfUser)
        .to.contain(delegator.address)
        .and.contain(cEther.address);
    });

    it(`Alice should have liquidity:
     90% * ${f(aliceCEtherMintAmount)} cEther 
     = ${f(aliceCEtherMintAmount.mul(9).div(10))} cEther,
    which can borrow:
     ${f(aliceCEtherMintAmount)} * 0.9 * 10 (10 times the price of WETH) 
     = ${f(aliceCEtherMintAmount.mul(0.9 * 10))} cWETH`, async () => {
      let scale = ethers.utils.parseEther('1');
      const liquidity = await comptroller.getAccountLiquidity(AliceAccount);
      const cEtherPrice = await oracle.getUnderlyingPrice(cEther.address);

      expect(
        liquidity[1].eq(
          aliceCEtherMintAmount
            .mul(cEtherPrice)
            .div(scale)
            .mul(cEtherCollateralFactor)
            .div(scale)
        )
      ).to.be.true;
    });
  });

  describe('Alice should be able to borrow some cWETH', async () => {
    it(`should borrow ${aliceCWETHBorrowAmount} cWETH`, async () => {
      const balance = await weth.balanceOf(AliceAccount);

      const resultRaw = await delegator.borrow(aliceCWETHBorrowAmount);
      await resultRaw.wait();

      const balanceNew = await weth.balanceOf(AliceAccount);

      const MAGIC_NUMBER = ethers.utils.parseUnits('3', 14);
      expect(
        balanceNew.sub(balance).gt(aliceCWETHBorrowAmount.sub(MAGIC_NUMBER))
      ).to.be.true;
    });

    it('should have positive liquidity and zero shortfall', async () => {
      const [__, liquidity, shortfall] = await comptroller.getAccountLiquidity(
        AliceAccount
      );
      expect(liquidity.gt(0)).to.be.true;
      expect(shortfall.eq(0)).to.be.true;
    });
  });

  describe('User should be prone to liquidation when shortfall is not zero', async () => {
    before(`cEther price suddenly dropped to 0.08 ETH`, async () => {
      const cEtherPrice = await oracle.getUnderlyingPrice(cEther.address);
      await oracle.setUnderlyingPrice(
        cEther.address,
        cEtherPrice.mul(8).div(100)
      );
    });

    it(`should have negative shortfall and zero liquidity now`, async () => {
      const [_, liquidity, shortfall] = await comptroller.getAccountLiquidity(
        AliceAccount
      );
      expect(liquidity.eq(0)).to.be.true;
      expect(shortfall.gt(0)).to.be.true;
    });
  });

  describe('could be liquidated', async () => {
    let liquidatorCWETHBalance;
    let shortfall;
    let liquidatorCWETHBalanceNew;
    let shortfallNew;

    before(async () => {
      liquidator = await ethers.getSigner(liquidatorAccount);
      cEtherForLiquidator = await ethers.getContractAt(
        'CEther',
        cEther.address,
        liquidator
      );
      comptrollerForLiquidator = await ethers.getContractAt(
        'ComptrollerG1',
        comptroller.address,
        liquidator
      );

      await comptrollerForLiquidator.enterMarkets([
        cEther.address,
        delegator.address,
      ]);
    });

    before(`Alice gets liquidated by ${liquidatorAccount}`, async () => {
      liquidatorCWETHBalance = await delegator.balanceOf(liquidatorAccount);
      [, liquidity, shortfall] = await comptroller.getAccountLiquidity(
        AliceAccount
      );

      const resultRaw = await cEtherForLiquidator.liquidateBorrow(
        AliceAccount,
        delegator.address,
        { value: aliceCWETHBorrowAmount.div(2) }
      );
      await resultRaw.wait();

      liquidatorCWETHBalanceNew = await delegator.balanceOf(liquidatorAccount);
      [, liquidityNew, shortfallNew] = await comptroller.getAccountLiquidity(
        AliceAccount
      );
    });

    it(`shortfall should be lower`, async () => {
      expect(shortfallNew.lt(shortfall)).to.be.true;
      // TODO: 應該要可以算出真正得到多少 cPig
      expect(liquidatorCWETHBalanceNew.gt(liquidatorCWETHBalance)).to.be.true;
    });
  });
});
