const { ethers } = require("hardhat");
const { accounts } = require("../nodes.constant");
const {
  readDeploymentData,
  writeDeploymentData,
} = require("./deploymentDataManipulation");

const deploy = async (tokenName) => {
  console.log("Deploying...");
  const ERCDelegate = await ethers.getContractFactory("CErc20Delegate");
  const ERCDelegator = await ethers.getContractFactory("CErc20Delegator");

  const deploymentData = await readDeploymentData();
  const {
    cTokenAddresses: { CPig },
    comptrollerAddress,
    interestRateModelAddress,
  } = deploymentData;

  const delegate = await ERCDelegate.deploy();
  const delegator = await ERCDelegator.deploy(
    CPig,
    comptrollerAddress,
    interestRateModelAddress,
    ethers.utils.parseUnits("1", 18),
    "CPig",
    "cPig",
    8,
    accounts[0].address,
    delegate.address,
    0x00
  );

  deploymentData.delegateAddress = delegator.address;
  deploymentData.delegatorAddress = delegator.address;

  writeDeploymentData(deploymentData);
  console.log("deployed delegate & delegator");
};

deploy("CPig").catch((error) => console.log(error));
