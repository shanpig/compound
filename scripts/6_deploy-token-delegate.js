const { ethers } = require("hardhat");
const { accounts } = require("../nodes.constant");
const {
  readDeploymentData,
  writeDeploymentData,
} = require("./deploymentDataManipulation");

const deploy = async () => {
  console.log("Deploying...");
  const ERCDelegate = await ethers.getContractFactory("CErc20Delegate");
  const ERCDelegator = await ethers.getContractFactory("CErc20Delegator");

  const deploymentData = await readDeploymentData();
  const {
    cTokenAddresses: { ERC20Pig },
    comptrollerAddress,
    interestRateModelAddress,
  } = deploymentData;

  const delegate = await ERCDelegate.deploy();
  await delegate.deployed();
  const delegator = await ERCDelegator.deploy(
    ERC20Pig,
    comptrollerAddress,
    interestRateModelAddress,
    ethers.utils.parseUnits("1", 18),
    "a test ERC20 token",
    "ERC20Pig",
    8,
    accounts[0].address,
    delegate.address,
    0x00
  );
  await delegator.deployed();

  deploymentData.delegateAddress = delegator.address;
  deploymentData.delegatorAddress = delegator.address;

  writeDeploymentData(deploymentData);
  console.log("deployed delegate & delegator");
};

deploy().catch((error) => console.log(error));
