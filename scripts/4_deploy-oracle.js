const { ethers } = require("hardhat");
const {
  readDeploymentData,
  writeDeploymentData,
} = require("./deploymentDataManipulation");

const deploy = async () => {
  console.log("Deploying...");
  const Oracle = await ethers.getContractFactory("SimplePriceOracle");

  const deploymentData = await readDeploymentData();

  const oracle = await Oracle.deploy();

  await oracle.deployed();

  deploymentData.oracleAddress = oracle.address;

  console.log("oracle deployed at: ", oracle.address);

  writeDeploymentData(deploymentData);
};

deploy().catch((error) => console.log(error));
