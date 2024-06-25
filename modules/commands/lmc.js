const { execSync } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const { builtinModules } = require("module");
const { Box } = require("fca-liane-utils");
const axios = require("axios");

class LMC {
  config = {
    name: "lmc",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "Liane Cagara",
    description:
      "[Liane Module Control] A Streamlined way of managing modules.",
    usePrefix: true,
    commandCategory: "Admin",
    usages: "[install/trash/reload/list/file/load/unload]",
    cooldowns: 1,
    dependencies: {
      "fca-liane-utils": "latest",
      child_process: "",
      path: "",
      fs: "",
      axios: "latest",
    },
  };

  async run(context) {
    const box = new Box(context.api, context.event, false);
    const pushMsg = (str) => box.reply(`${this.logo}\n\n${str}`);
    const config = await this.loadConfig();
    if (!config.ADMINBOT || !config.ADMINBOT.includes(context.event.senderID)) {
      return pushMsg(`❌ Only bot admins are permitted to use the LMC.`);
    }
    try {
      const i = await this.main({
        ...context,
        box,
        args: box.args,
        pushMsg,
        config,
      });
      return i;
    } catch (error) {
      return box.error(error);
    }
  }
  logo = `🔧 𝗟𝗠𝗖 ⚙️`;

  async main(context) {
    const type = `handle$${context.args[0]}`;
    if (this[type]) {
      return this[type](context);
    }
    const { pushMsg } = context;

    const allTypes = Object.getOwnPropertyNames(LMC.prototype)
      .filter((key) => key.startsWith("handle$"))
      .map((key) => {
        const { PREFIX } = context.config;
        const cleanKey = key.replaceAll("handle$", "");
        const guide = this.handlerGuide[cleanKey] ?? "";
        return `${PREFIX}lmc ${cleanKey} ${guide}`;
      });
    return pushMsg(allTypes.join("\n"));
  }

  handlerGuide = {
    install: `[fileName, url || ...codes]`,
    load: `[...fileNames]`,
    unload: `[...fileNames]`,
    trash: `[fileName]`,
    file: `[fileName]`,
    reload: ``,
    list: ``,
  };

  async handle$install() {}

  async handle$load() {}

  async handle$unload() {}

  async handle$trash() {}

  async handle$file() {}

  async handle$reload() {}

  async handle$list({ pushMsg, config }) {
    const files = (await fs.readdir(__dirname)).filter((file) =>
      file.endsWith(".js"),
    );
    const list = files.map(
      (file, index) =>
        `${index + 1 < 10 ? `0${index + 1}` : `${index + 1}`}. ${file}${config.commandDisabled.includes(file) ? ` (unloaded)` : ``}`,
    );
    return pushMsg(
      `✅ Found ${files.length} module files:\n\n${list.join("\n")}\n\nYou can use "${config.PREFIX}lmc file [fileName]" to get the file.`,
    );
  }

  async loadConfig() {
    try {
      const { configPath } = global.client;
      const data = await fs.readFile(configPath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      throw error;
    }
  }

  async loadCommand({ moduleList }) {
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

        if (
          !command.config ||
          !command.run ||
          !command.config.commandCategory
        ) {
          throw new Error("Module is malformed!");
        }

        client.commands.delete(nameModule);

        if (command.config.dependencies) {
          const listPackage = JSON.parse(
            await fs.readFile("/package.json", "utf8"),
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

    await fs.writeFile(
      configPath,
      JSON.stringify(configValue, null, 4),
      "utf8",
    );
    await fs.unlink(tempConfigPath);
    return { resultModules, resultErrors };
  }

  async unloadCommand({ moduleList }) {
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

    await fs.writeFile(
      configPath,
      JSON.stringify(configValue, null, 4),
      "utf8",
    );
    await fs.unlink(tempConfigPath);
  }
}

module.exports = new LMC();
