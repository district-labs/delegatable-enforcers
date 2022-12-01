import { HardhatRuntimeEnvironment } from "hardhat/types";

export default async function deploy(hardhat: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hardhat;

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy("TurboERC721", {
    contract: "MintableERC721",
    from: deployer,
    args: ["Turbo ERC721", "TRBO"],
    skipIfAlreadyDeployed: false,
    log: true,
  });
}
