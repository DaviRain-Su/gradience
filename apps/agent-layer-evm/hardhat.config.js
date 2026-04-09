require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

/** @type import("hardhat/config").HardhatUserConfig */
module.exports = {
    paths: {
        sources: "./src",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
    solidity: {
        compilers: [
            {
                version: "0.8.24",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    viaIR: true,
                    evmVersion: "cancun",
                },
            },
            {
                version: "0.6.8",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true,
        },
        baseSepolia: {
            url: BASE_SEPOLIA_RPC_URL || "",
            chainId: 84532,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
        },
    },
};
