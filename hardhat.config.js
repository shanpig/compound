const { extendEnvironment } = require("hardhat/config");
const { readDeploymentData } = require("./scripts/deploymentDataManipulation");
const { accounts } = require("./nodes.constant");

require("@nomiclabs/hardhat-ethers");

extendEnvironment((hre) => {
  const deployComptroller = async (address) => {
    console.log("attaching comptroller...");
    const Comptroller = await ethers.getContractFactory("ComptrollerG1");
    return await Comptroller.attach(address);
  };

  const deployInterestRateModel = async (address) => {
    console.log("attaching interest model...");
    const WhitePaperInterestRateModel = await ethers.getContractFactory(
      "WhitePaperInterestRateModel"
    );
    return await WhitePaperInterestRateModel.attach(address);
  };

  const deployCEther = async (address) => {
    console.log("attaching CEther...");
    const CEther = await ethers.getContractFactory("CEther");
    return await CEther.attach(address);
  };

  const deployERC20Pig = async (address) => {
    console.log("attaching ERC20Pig...");
    const ERC20Pig = await ethers.getContractFactory("ERC20Pig");
    return await ERC20Pig.attach(address);
  };

  const deployERC20Delegate = async (address) => {
    console.log("attaching cPig delegate...");
    const Delegate = await ethers.getContractFactory("CErc20Delegate");
    return await Delegate.attach(address);
  };

  const deployERC20Delegator = async (address) => {
    console.log("attaching cPig delegator...");
    const Delegator = await ethers.getContractFactory("CErc20Delegator");
    return await Delegator.attach(address);
  };

  const deployOracle = async (address) => {
    console.log("attaching price oracle...");
    const SimplePriceOracle = await ethers.getContractFactory(
      "SimplePriceOracle"
    );
    return await SimplePriceOracle.attach(address);
  };

  const mintCEther = async (targetAddress, cEther) => {
    let value = await cEther.balanceOf(targetAddress);
    console.log("current account balance is: ", value);

    console.log("mint cEther for account ", targetAddress, "...");
    await cEther.mint({ value: 100 });
    value = await cEther.balanceOf(targetAddress);
    console.log("now account balance is: ", value);
  };

  const approveERC20Pig = async (token, delegator, amount) => {
    console.log("pre-approving ERC20Pig token to delegator...");
    await token.approve(delegator.address, amount);
  };

  const buildEnv = async () => {
    const deploymentData = await readDeploymentData();
    const {
      comptrollerAddress,
      interestRateModelAddress,
      cTokenAddresses,
      oracleAddress,
      delegateAddress,
      delegatorAddress,
    } = deploymentData;
    const tokensAddresses = cTokenAddresses;

    const comptroller = await deployComptroller(comptrollerAddress);

    const interestRateModel = await deployInterestRateModel(
      interestRateModelAddress
    );

    const cEther = await deployCEther(tokensAddresses.CEther);

    const pig = await deployERC20Pig(tokensAddresses.ERC20Pig);

    const delegate = await deployERC20Delegate(delegateAddress);

    const delegator = await deployERC20Delegator(delegatorAddress);

    const oracle = await deployOracle(oracleAddress);

    console.log("supporting ERC20Pig...");
    await comptroller._setCollateralFactor(
      tokensAddresses.ERC20Pig,
      ethers.utils.parseUnits("0.5", 18)
    );
    await comptroller._supportMarket(delegator.address);

    console.log("setting ERC20Pig price...");
    await oracle.setDirectPrice(cEther.address, 1);
    await oracle.setDirectPrice(pig.address, ethers.utils.parseUnits("10", 18));

    console.log("setting price oracle...");
    await comptroller._setPriceOracle(oracle.address);

    await mintCEther(accounts[0].address, cEther);

    await approveERC20Pig(pig, delegator, 100);

    console.log("initialization finished.");
    hre.contractAttached = {
      comptroller,
      interestRateModel,
      oracle,
      cEther,
      accounts,
      pig,
      delegate,
      delegator,
    };
  };

  hre.buildEnv = buildEnv;
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: "localhost",
  networks: {
    localhost: {
      url: "http://localhost:8545",
    },
  },
};
