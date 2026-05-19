const { withDangerousMod, createRunOncePlugin } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function withNextlibMedia3ext(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const libsDir = path.join(projectRoot, "android", "app", "libs");
      const targetFile = path.join(libsDir, "nextlib-media3ext-1.10.0-0.12.1.aar");
      const sentinelFile = path.join(libsDir, ".nextlib-installed");

      if (fs.existsSync(sentinelFile)) {
        console.log("✓ Nextlib already installed");
        return config;
      }

      console.log("📥 Downloading nextlib-media3ext AAR directly...");
      fs.mkdirSync(libsDir, { recursive: true });

      const url = "https://repo1.maven.org/maven2/io/github/anilbeesetti/nextlib-media3ext/1.10.0-0.12.1/nextlib-media3ext-1.10.0-0.12.1.aar";
      
      execSync(`curl -fsSL -o "${targetFile}" "${url}"`, {
        stdio: "inherit",
        cwd: projectRoot,
      });

      if (!fs.existsSync(targetFile)) {
        throw new Error("Failed to download nextlib-media3ext AAR");
      }

      fs.writeFileSync(sentinelFile, new Date().toISOString());
      console.log("✅ Nextlib installed successfully");

      return config;
    },
  ]);
}

module.exports = createRunOncePlugin(
  withNextlibMedia3ext,
  "nextlib-media3ext-installer",
  "1.0.0"
);