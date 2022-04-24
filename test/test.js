const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const BigNumber = ethers.BigNumber;

const AliceAccount = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const BobAccount = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const liquidatorAccount = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
const scale = BigNumber.from("10").pow("18");

const liquidationIncentive = BigNumber.from("100").mul(scale).div(100);
const amountBorrowed = BigNumber.from("70").mul(scale);

const cEtherExchangeRate = BigNumber.from("1").mul(scale);
const cEtherMintValue = BigNumber.from("100").mul(scale);
const cEtherCollateralFactor = BigNumber.from("90").mul(
  BigNumber.from("10").pow("16")
);

const cPigExchangeRate = BigNumber.from("1").mul(scale);
const cPigMintValue = BigNumber.from("1000").mul(scale);
const cPigCollateralFactor = BigNumber.from("75").mul(
  BigNumber.from("10").pow("16")
);

const deployComptroller = async () => {
  const Comptroller = await ethers.getContractFactory("ComptrollerG1");
  const comptroller = await Comptroller.deploy();
  await comptroller.deployed();
  return comptroller;
};

const deployInterestRateModel = async () => {
  const InterestRateModel = await ethers.getContractFactory(
    "WhitePaperInterestRateModel"
  );
  const interestRateModel = await InterestRateModel.deploy(0, 0);
  await interestRateModel.deployed();
  return interestRateModel;
};

const deployCEther = async (comptrollerAddress, interestRateModelAddress) => {
  const CToken = await ethers.getContractFactory("CEther");
  const cToken = await CToken.deploy(
    comptrollerAddress,
    interestRateModelAddress,
    cEtherExchangeRate,
    "CEther",
    "cETH",
    18,
    AliceAccount
  );
  await cToken.deployed();
  return cToken;
};

const deployOracle = async () => {
  const Oracle = await ethers.getContractFactory("SimplePriceOracle");
  const oracle = await Oracle.deploy();
  await oracle.deployed();
  return oracle;
};

const deployERC20Pig = async () => {
  const ERC20Pig = await ethers.getContractFactory("ERC20Pig");
  const Pig = await ERC20Pig.deploy();
  await Pig.deployed();
  return Pig;
};

const deployDelegate = async () => {
  const ERCDelegate = await ethers.getContractFactory("CErc20Delegate");
  const delegate = await ERCDelegate.deploy();
  await delegate.deployed();
  return delegate;
};

const deployDelegator = async (
  PigAddress,
  comptrollerAddress,
  interestRateModelAddress,
  adminAddress,
  delegateAddress
) => {
  const ERCDelegator = await ethers.getContractFactory("CErc20Delegator");
  const delegator = await ERCDelegator.deploy(
    PigAddress,
    comptrollerAddress,
    interestRateModelAddress,
    cPigExchangeRate,
    "a test ERC20 token",
    "ERC20Pig",
    1,
    adminAddress,
    delegateAddress,
    0x00
  );
  await delegator.deployed();
  return delegator;
};

describe("compound practice", async () => {
  let comptroller;
  let interestRateModel;
  let cEther;
  let oracle;
  let Pig;
  let delegate;
  let delegator;

  before(async () => {
    comptroller = await deployComptroller();
    interestRateModel = await deployInterestRateModel();
    cEther = await deployCEther(comptroller.address, interestRateModel.address);
    oracle = await deployOracle();
    Pig = await deployERC20Pig();
    delegate = await deployDelegate();
    delegator = await deployDelegator(
      Pig.address,
      comptroller.address,
      interestRateModel.address,
      AliceAccount,
      delegate.address
    );
    await comptroller._setCloseFactor(scale.div(2));
    await comptroller._setPriceOracle(oracle.address);
    await comptroller._setMaxAssets(12);
    await comptroller._setLiquidationIncentive(liquidationIncentive);
  });

  describe("oracle should have price", async () => {
    it("should set underlying price to cEther", async () => {
      const price = await oracle.getEtherPrice();
      const actualEtherPrice = price.mul(scale);
      await oracle.setUnderlyingPrice(cEther.address, actualEtherPrice);

      const cEtherPrice = await oracle.getUnderlyingPrice(cEther.address);
      expect(cEtherPrice.eq(actualEtherPrice)).to.be.true;
    });

    it("should set underlying price of cPig as 1/10 to cEther ", async () => {
      const cEtherPrice = await oracle.getUnderlyingPrice(cEther.address);
      await oracle.setUnderlyingPrice(delegator.address, cEtherPrice.div(10));

      const pigPrice = await oracle.getUnderlyingPrice(delegator.address);
      expect(pigPrice.eq(cEtherPrice.div(10))).to.be.true;
    });
  });

  describe("should successFully deployed", async () => {
    it("should deploy Comptroller", async () => {
      expect(comptroller.address).to.be.a("string");
    });
    it("should deploy InterestRateModel", async () => {
      expect(interestRateModel.address).to.be.a("string");
    });
    it("should deploy CEther", async () => {
      expect(cEther.address).to.be.a("string");
    });
    it("should deploy Oracle", async () => {
      expect(oracle.address).to.be.a("string");
    });
    it("should deploy ERC20Pig", async () => {
      expect(Pig.address).to.be.a("string");
    });
    it("should deploy Delegate", async () => {
      expect(delegate.address).to.be.a("string");
    });
    it("should deploy Delegator", async () => {
      expect(delegator.address).to.be.a("string");
    });
  });

  describe("comptroller should support market CEther and CPig", async () => {
    let cEtherError;
    let cPigError;

    before(async () => {
      cEtherError = await (
        await comptroller._supportMarket(cEther.address)
      ).wait();
      cPigError = await (
        await comptroller._supportMarket(delegator.address)
      ).wait();
    });

    it("should support market CEther", async () => {
      expect(cEtherError.events.some((event) => event.event === "Failure")).to
        .be.false;
    });
    it("should support market Pig", async () => {
      expect(cPigError.events.some((event) => event.event === "Failure")).to.be
        .false;
    });
  });

  describe("comptroller should set collateral factor to CEther and CPig", async () => {
    it("should set collateral factor", async () => {
      const cEtherError = await (
        await comptroller._setCollateralFactor(
          cEther.address,
          cEtherCollateralFactor
        )
      ).wait();
      const cPigError = await (
        await comptroller._setCollateralFactor(
          delegator.address,
          cPigCollateralFactor
        )
      ).wait();

      expect(cEtherError.events.some((event) => event.event !== "Failure")).to
        .be.true;
      expect(cPigError.events.some((event) => event.event !== "Failure")).to.be
        .true;
    });
  });

  describe(`should use second user to mint cETH and liquidate the pool`, async () => {
    let secondUser;
    let cEtherForSecondUser;
    let comptrollerForSecondUser;

    before(async () => {
      secondUser = await ethers.getSigner(BobAccount);
      cEtherForSecondUser = await ethers.getContractAt(
        "CEther",
        cEther.address,
        secondUser
      );
      comptrollerForSecondUser = await ethers.getContractAt(
        "ComptrollerG1",
        comptroller.address,
        secondUser
      );
    });

    it("the mint event should be successful", async () => {
      const balance = await cEtherForSecondUser.balanceOf(BobAccount);
      await cEtherForSecondUser.mint({ value: cEtherMintValue.toString() });
      const balanceNew = await cEtherForSecondUser.balanceOf(BobAccount);

      expect(
        balanceNew.eq(
          balance.add(cEtherMintValue.mul(scale).div(cEtherExchangeRate))
        )
      ).to.be.true;
    });

    it("should be able to enter market", async () => {
      await comptrollerForSecondUser.enterMarkets([
        cEtherForSecondUser.address,
      ]);
      const assetsInPool = await comptrollerForSecondUser.getAssetsIn(
        secondUser.address
      );
      expect(assetsInPool).to.contain(cEther.address);
    });

    // after(async () => {
    //   await network.provider.request({
    //     method: "hardhat_stopImpersonatingAccount",
    //     params: [BobAccount],
    //   });
    // });
  });

  describe(`should be able to mint and redeem cPig`, async () => {
    it(`user ${AliceAccount} should have some Pig token`, async () => {
      const balance = await Pig.balanceOf(AliceAccount);
      expect(balance.gt(BigNumber.from("0"))).to.be.true;
    });

    it(`user ${AliceAccount} should approve Pig token amount: ${cPigMintValue} to delegator`, async () => {
      const allowed = await (
        await Pig.approve(delegator.address, cPigMintValue)
      ).wait();

      expect(allowed.events.some((event) => event.event === "Failure")).to.be
        .false;
    });

    it(`user ${AliceAccount} should be able to mint cPig`, async () => {
      const mintAllowed = await (
        await comptroller.mintAllowed(
          delegator.address,
          AliceAccount,
          cPigMintValue
        )
      ).wait();

      expect(mintAllowed.events.some((event) => event.event === "Failure")).to
        .be.false;
    });

    it(`user ${AliceAccount} should mint Pig: ${cPigMintValue} -> cPig: ${cPigMintValue.div(
      cPigExchangeRate
    )}`, async () => {
      const balance = await delegator.balanceOf(AliceAccount);
      await delegator.mint(cPigMintValue);
      const balanceNew = await delegator.balanceOf(AliceAccount);
      expect(balanceNew.eq(balance.add(cPigMintValue))).to.be.true;
    });

    it(`user ${AliceAccount} should be able to redeem cPig`, async () => {
      const redeemAllowed = await (
        await comptroller.redeemAllowed(
          delegator.address,
          AliceAccount,
          cPigMintValue
        )
      ).wait();

      expect(redeemAllowed.events.some((event) => event.event === "Failure")).to
        .be.false;
    });

    it(`user ${AliceAccount} should redeem cPig: ${cPigMintValue.div(
      cPigExchangeRate
    )} -> Pig: ${cPigMintValue}`, async () => {
      const balance = await Pig.balanceOf(AliceAccount);
      await (await delegator.redeemUnderlying(cPigMintValue)).wait();

      const balanceNew = await Pig.balanceOf(AliceAccount);

      expect(balanceNew.eq(balance.add(cPigMintValue))).to.be.true;
    });

    it(`user ${AliceAccount} now should have no cPig`, async () => {
      const balance = await delegator.balanceOf(AliceAccount);
      expect(balance.eq(BigNumber.from("0"))).to.be.true;
    });
  });

  describe(`User enter market by collateral: cPig ${cPigMintValue}`, async () => {
    before(async () => {
      await Pig.approve(delegator.address, cPigMintValue);
      await delegator.mint(cPigMintValue);
    });

    it(`should have cPig balance: ${cPigMintValue}`, async () => {
      const balance = await delegator.balanceOf(AliceAccount);
      expect(balance.eq(cPigMintValue)).to.be.true;
    });

    it(`should enter market`, async () => {
      const resultRaw = await comptroller.enterMarkets([
        delegator.address,
        cEther.address,
      ]);
      await resultRaw.wait();

      const assetsOfUser = await comptroller.getAssetsIn(AliceAccount);
      expect(assetsOfUser).to.contain(delegator.address);
      expect(assetsOfUser).to.contain(cEther.address);
    });

    it(`should have liquidity worthy of 75% * ${cPigMintValue} cPig = ${
      cPigMintValue * 0.75
    } cPig`, async () => {
      const liquidity = await comptroller.getAccountLiquidity(AliceAccount);
      const cPigPrice = await oracle.getUnderlyingPrice(delegator.address);

      expect(
        liquidity[1].eq(
          cPigMintValue
            .mul(cPigPrice)
            .div(scale)
            .mul(cPigCollateralFactor)
            .div(scale)
        )
      ).to.be.true;
    });
  });

  describe("user should be able to borrow some CEther", async () => {
    it(`should borrow ${amountBorrowed} cETH`, async () => {
      const user = await ethers.getSigner(AliceAccount);
      const balance = await user.getBalance();

      const resultRaw = await cEther.borrow(amountBorrowed);
      await resultRaw.wait();

      const balanceNew = await user.getBalance();

      const MAGIC_NUMBER = BigNumber.from("300000000000000");
      expect(balanceNew.sub(balance).gt(amountBorrowed.sub(MAGIC_NUMBER))).to.be
        .true;
    });

    it("should have positive liquidity and zero shortfall", async () => {
      const [__, liquidity, shortfall] = await comptroller.getAccountLiquidity(
        AliceAccount
      );
      expect(liquidity.gt(0)).to.be.true;
      expect(shortfall.eq(0)).to.be.true;
    });
  });

  describe("User should be prone to liquidation when shortfall is below zero", async () => {
    before(`cPig price suddenly dropped to 0.08 ETH`, async () => {
      const cEtherPrice = await oracle.getUnderlyingPrice(cEther.address);
      await oracle.setUnderlyingPrice(
        delegator.address,
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

  describe("could be liquidated", async () => {
    let liquidatorCPigBalance;
    let liquidity;
    let shortfall;
    let liquidatorCPigBalanceNew;
    let liquidityNew;
    let shortfallNew;

    before(async () => {
      liquidator = await ethers.getSigner(liquidatorAccount);
      cEtherForLiquidator = await ethers.getContractAt(
        "CEther",
        cEther.address,
        liquidator
      );
      comptrollerForLiquidator = await ethers.getContractAt(
        "ComptrollerG1",
        comptroller.address,
        liquidator
      );

      await comptrollerForLiquidator.enterMarkets([
        cEther.address,
        delegator.address,
      ]);
    });

    before(
      `user ${AliceAccount} gets liquidated by ${liquidatorAccount}`,
      async () => {
        liquidatorCPigBalance = await delegator.balanceOf(liquidatorAccount);
        [, liquidity, shortfall] = await comptroller.getAccountLiquidity(
          AliceAccount
        );

        const resultRaw = await cEtherForLiquidator.liquidateBorrow(
          AliceAccount,
          delegator.address,
          { value: amountBorrowed.div(2) }
        );
        await resultRaw.wait();

        liquidatorCPigBalanceNew = await delegator.balanceOf(liquidatorAccount);
        [, liquidityNew, shortfallNew] = await comptroller.getAccountLiquidity(
          AliceAccount
        );
      }
    );

    it(`shortfall should be lower`, async () => {
      expect(shortfallNew.lt(shortfall)).to.be.true;
      // TODO: 應該要可以算出真正得到多少 cPig
      expect(liquidatorCPigBalanceNew.gt(liquidatorCPigBalance)).to.be.true;
    });
  });
});
