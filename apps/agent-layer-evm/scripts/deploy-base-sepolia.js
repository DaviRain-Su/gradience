const { ethers, network } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const treasury = process.env.TREASURY_ADDRESS || deployer.address;

    if (!ethers.isAddress(treasury)) {
        throw new Error(`Invalid TREASURY_ADDRESS: ${treasury}`);
    }

    const factory = await ethers.getContractFactory("AgentLayerRaceTask");
    const contract = await factory.deploy(treasury);
    await contract.waitForDeployment();

    console.log("network:", network.name);
    console.log("deployer:", deployer.address);
    console.log("treasury:", treasury);
    console.log("agent_layer_race_task:", await contract.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
