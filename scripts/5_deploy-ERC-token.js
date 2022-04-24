const { ethers } = require("hardhat");
const {
  readDeploymentData,
  writeDeploymentData,
} = require("./deploymentDataManipulation");

const deploy = async () => {
  console.log("Deploying...");
  const ERC20Pig = await ethers.getContractFactory("ERC20Pig");

  const deploymentData = await readDeploymentData();

  const pig = await ERC20Pig.deploy();

  await pig.deployed();

  deploymentData.cTokenAddresses = {
    ...deploymentData.cTokenAddresses,
    ERC20Pig: pig.address,
  };

  console.log("token ERC20Pig deployed at: ", pig.address);

  writeDeploymentData(deploymentData);
};

deploy().catch((error) => console.log(error));
