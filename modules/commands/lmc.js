const { execSync } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const { builtinModules } = require("module");

async function loadCommand({ moduleList }) {
  const resultModules = [];
  const resultErrors = [];
  const { configPath, mainPath, client } = global.client;

  let configValue = JSON.parse(await fs.readFile(configPath, "utf-8"));
  const tempConfigPath = `${configPath}.temp`;
  await fs.writeFile(
    tempConfigPath,
    JSON.stringify(configValue, null, 2),
    "utf8",
  );

  for (const nameModule of moduleList) {
    try {
      const dirModule = path.join(
        mainPath,
        "modules",
        "commands",
        `${nameModule}.js`,
      );
      delete require.cache[require.resolve(dirModule)];
      const command = require(dirModule);

      if (!command.config || !command.run || !command.config.commandCategory) {
        throw new Error("Module is malformed!");
      }

      client.commands.delete(nameModule);

      if (command.config.dependencies) {
        const listPackage = JSON.parse(
          await fs.readFile(path.join(mainPath, "package.json")),
        ).dependencies;

        for (const packageName in command.config.dependencies) {
          try {
            if (
              listPackage[packageName] ||
              builtinModules.includes(packageName)
            ) {
              require(packageName);
            } else {
              execSync(
                `npm install ${packageName}@${command.config.dependencies[packageName] || ""}`,
                {
                  stdio: "inherit",
                  cwd: path.join(mainPath, "node_modules"),
                },
              );
              require(packageName);
            }
          } catch (error) {
            throw new Error(
              `Unable to load package ${packageName} for module ${command.config.name}: ${error.stack}`,
            );
          }
        }
      }

      if (command.config.envConfig) {
        const envConfig = command.config.envConfig;
        configValue[command.config.name] =
          configValue[command.config.name] || {};

        for (const [key, value] of Object.entries(envConfig)) {
          configValue[command.config.name][key] =
            configValue[command.config.name][key] || value || "";
        }
      }

      if (command.onLoad) {
        await command.onLoad({ configValue });
      }

      if (command.handleEvent) {
        client.eventRegistered.push(command.config.name);
      }

      client.commands.set(command.config.name, command);
      resultModules.push(command);
      resultErrors.push(null);
    } catch (error) {
      resultErrors.push(error);
      resultModules.push(null);
    }
  }

  await fs.writeFile(configPath, JSON.stringify(configValue, null, 4), "utf8");
  await fs.unlink(tempConfigPath);
  return { resultModules, resultErrors };
}

async function unloadCommand({ moduleList }) {
  const { configPath, client } = global.client;

  let configValue = JSON.parse(await fs.readFile(configPath, "utf-8"));
  const tempConfigPath = `${configPath}.temp`;
  await fs.writeFile(
    tempConfigPath,
    JSON.stringify(configValue, null, 4),
    "utf8",
  );

  for (const nameModule of moduleList) {
    client.commands.delete(nameModule);
    client.eventRegistered = client.eventRegistered.filter(
      (item) => item !== nameModule,
    );
    configValue.commandDisabled.push(`${nameModule}.js`);
    global.config.commandDisabled.push(`${nameModule}.js`);
  }

  await fs.writeFile(configPath, JSON.stringify(configValue, null, 4), "utf8");
  await fs.unlink(tempConfigPath);
}

module.exports = {
  loadCommand,
  unloadCommand,
};
