import { spawn, execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function log(tag, msg) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [${tag}] ${msg}`);
}

async function waitForNode(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      });
      if (res.ok) return true;
    } catch {
      // Node not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Hardhat node did not start in time.");
}

async function main() {
  console.log("\n====================================================");
  console.log("   MEW - Mostar Eco View  |  Local Dev Launcher");
  console.log("====================================================\n");

  // Step 1: Install frontend dependencies if needed
  const frontendDir = path.join(ROOT, "frontend");
  try {
    const { statSync } = await import("fs");
    statSync(path.join(frontendDir, "node_modules"));
  } catch {
    log("SETUP", "Installing frontend dependencies...");
    execSync("npm install --legacy-peer-deps", { cwd: frontendDir, stdio: "inherit" });
  }

  // Step 2: Start Hardhat local node
  log("NODE", "Starting Hardhat local blockchain node...");
  const hardhatNode = spawn("npx", ["hardhat", "node"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  hardhatNode.stdout.on("data", (data) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      // Only show important lines, not every account
      if (line.includes("Started HTTP") || line.includes("eth_")) {
        log("NODE", line.trim());
      }
    }
  });

  hardhatNode.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) log("NODE:ERR", msg);
  });

  hardhatNode.on("exit", (code) => {
    log("NODE", `Hardhat node exited with code ${code}`);
    process.exit(code || 1);
  });

  // Step 3: Wait for the node to be ready
  log("NODE", "Waiting for Hardhat node to be ready...");
  await waitForNode("http://127.0.0.1:8545");
  log("NODE", "✅ Hardhat node is live at http://127.0.0.1:8545");

  // Step 4: Deploy contracts to local node
  log("DEPLOY", "Compiling and deploying smart contracts...");
  try {
    execSync("npx hardhat run scripts/deploy-local.js --network localhost", {
      cwd: ROOT,
      stdio: "inherit",
    });
    log("DEPLOY", "✅ Contracts deployed and ABIs written to frontend.");
  } catch (err) {
    log("DEPLOY", "❌ Contract deployment failed!");
    console.error(err);
    hardhatNode.kill();
    process.exit(1);
  }

  // Step 5: Start Next.js frontend
  log("UI", "Starting Next.js frontend dev server...");
  const frontend = spawn("npx", ["next", "dev", "--port", "3000"], {
    cwd: frontendDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  frontend.stdout.on("data", (data) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      log("UI", line.trim());
    }
  });

  frontend.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes("ExperimentalWarning")) {
      log("UI:ERR", msg);
    }
  });

  frontend.on("exit", (code) => {
    log("UI", `Frontend exited with code ${code}`);
    hardhatNode.kill();
    process.exit(code || 0);
  });

  // Graceful shutdown
  const cleanup = () => {
    log("MAIN", "Shutting down...");
    frontend.kill();
    hardhatNode.kill();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  log("MAIN", "====================================================");
  log("MAIN", "🌿 MEW is running!");
  log("MAIN", "   Blockchain:  http://127.0.0.1:8545");
  log("MAIN", "   Frontend:    http://localhost:3000");
  log("MAIN", "   Press Ctrl+C to stop.");
  log("MAIN", "====================================================");
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
