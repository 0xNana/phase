import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { DeployFunction } from "hardhat-deploy/types";

const configureCUSDCFaucet: DeployFunction = async function configureCUSDCFaucet(
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts } = hre;
  const { execute, get, read } = deployments;
  const { deployer } = await getNamedAccounts();
  const token = await get("CUSDCToken");
  const faucet = await get("CUSDCFaucet");
  const currentFaucet = (await read("CUSDCToken", "faucet")) as string;

  if (currentFaucet.toLowerCase() === faucet.address.toLowerCase()) return;

  await execute("CUSDCToken", { from: deployer, log: true }, "setFaucet", faucet.address);
};

configureCUSDCFaucet.tags = ["CUSDCFaucetConfig"];
configureCUSDCFaucet.dependencies = ["CUSDCToken", "CUSDCFaucet"];

export default configureCUSDCFaucet;
