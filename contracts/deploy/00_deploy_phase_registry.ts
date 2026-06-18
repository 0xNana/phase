import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { DeployFunction } from "hardhat-deploy/types";

const deployPhaseRegistry: DeployFunction = async function deployPhaseRegistry(
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("PhaseCampaignRegistry", {
    from: deployer,
    args: [],
    log: true,
  });
};

deployPhaseRegistry.tags = ["PhaseRegistry"];

export default deployPhaseRegistry;
