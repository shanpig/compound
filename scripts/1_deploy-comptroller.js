const { ethers } = require("hardhat");

const deployComptroller = async () => {
  console.log("Deploying...");
  const Comptroller = await ethers.getContractFactory("ComptrollerG1");
  const comptroller = await Comptroller.deploy();
  await comptroller.deployed();

  console.log("deployed at ", comptroller.address);

  // const deploymentData = await readDeploymentData();
  // deploymentData.comptrollerAddress = comptroller.address;

  // writeDeploymentData(deploymentData);
  return comptroller.address;
};

module.exports = {
  deployComptroller,
};
