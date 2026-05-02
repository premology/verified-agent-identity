const { KmsKeyType, hexToBytes } = require("@0xpolygonid/js-sdk");
const { DidMethod, Blockchain, NetworkId } = require("@iden3/js-iden3-core");
const { SigningKey, Wallet, JsonRpcProvider } = require("ethers");
const fs = require("fs");

const { getInitializedRuntime } = require("./shared/bootstrap");
const {
  parseArgs,
  formatError,
  outputSuccess,
  addHexPrefix,
} = require("./shared/utils");

async function main() {
  try {
    const args = parseArgs();
    const {
      kms,
      identityWallet,
      didsStorage,
      billionsMainnetConfig,
      revocationOpts,
    } = await getInitializedRuntime();

    // =========================
    // PRIVATE KEY GENERATION
    // =========================
    let privateKeyHex = args.key;

    if (!privateKeyHex) {
      privateKeyHex = new SigningKey(Wallet.createRandom().privateKey)
        .privateKey;
    }

    // =========================
    // SAVE PRIVATE KEY (SAFE)
    // =========================
    const dir = ".clawhub";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    fs.writeFileSync(
      ".clawhub/private-key.json",
      JSON.stringify(
        {
          privateKey: privateKeyHex,
        },
        null,
        2
      )
    );

    // =========================
    // CREATE SIGNER
    // =========================
    const signer = new SigningKey(addHexPrefix(privateKeyHex));

    // =========================
    // CHECK KMS PROVIDER
    // =========================
    const keyProvider = kms.getKeyProvider(KmsKeyType.Secp256k1);
    if (!keyProvider) {
      console.error("Error: Secp256k1 key provider not found");
      process.exit(1);
    }

    // =========================
    // CREATE WALLET
    // =========================
    const wallet = new Wallet(
      signer,
      new JsonRpcProvider(billionsMainnetConfig.url)
    );

    // =========================
    // CREATE DID
    // =========================
    let did;
    try {
      const result = await identityWallet.createEthereumBasedIdentity({
        method: DidMethod.Iden3,
        blockchain: Blockchain.Billions,
        networkId: NetworkId.Main,
        seed: hexToBytes(privateKeyHex),
        revocationOpts: revocationOpts,
        ethSigner: wallet,
        createBjjCredential: false,
      });

      did = result.did;
    } catch (err) {
      console.error(
        `Error: Failed to create Ethereum-based identity: ${err.message}`
      );
      process.exit(1);
    }

    // =========================
    // SAVE DID
    // =========================
    await didsStorage.save({
      did: did.string(),
      publicKeyHex: signer.publicKey,
      isDefault: true,
    });

    // =========================
    // OUTPUT ONLY DID (SAFE)
    // =========================
    outputSuccess(did.string());
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

main();
