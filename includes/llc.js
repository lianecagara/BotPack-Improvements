const WebSocket = require("ws");
const axios = require("axios");

const defaultUrl = `https://liasparklivechat.onrender.com`;

class LLCBot {
  #onEvent;
  constructor({ username, url = defaultUrl, token, local, port }) {
    this.ws = null;
    this.botName = username;
    this.username = username;
    this.#onEvent = async function () {};
    this.url = url;
    this.token = token ?? null;
    this.onFuncs = {};
    this.queue = [];
    this.onlineUsers = [];
    this.isLocal = !!local;
    this.port = port;
  }

  async startListening(callback) {
    let { token, username, url } = this;
    console.log("Listening started!");
    if (!token) {
      try {
        token = await this.makeToken(username);
        this.token = token;
      } catch (error) {
        console.log(`Failed Getting token:`, error.message);
        return;
      }
    }
    let {
      data: { url: wsUrl },
    } = await axios.get(`${url}/ws-url`);
    if (this.isLocal) {
      wsUrl = `wss://localhost:${this.port}/ws`;
    }
    this.ws = new WebSocket(wsUrl);
    const { ws } = this;

    ws.onopen = (i) => {
      if (typeof this.onFuncs.ws_open == "function") {
        this.onFuncs.ws_open(i);
      }
      this.wsSend({
        type: "presence",
      });
      console.log(`Connected to ${wsUrl} as ${username}`);
    };

    ws.onmessage = (info) => this.handleListen(info);
    ws.onclose = () => {
      if (typeof this.onFuncs.ws_close == "function") {
        this.onFuncs.ws_close();
        this.startListening(callback);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error.message);
    };

    this.#onEvent = typeof callback === "function" ? callback : async () => {};
  }

  async makeToken(username) {
    console.log(`Getting token for ${username}...`);
    const res = await axios.get(`${this.url}/api/request_access_token`, {
      params: { username },
    });
    const { token, type, message } = res.data;
    if (type === "fail") {
      throw new Error(message);
    } else if (type === "success") {
      console.log(`Got token ${token} for username ${username}.`);
      return token;
    }
  }

  async handleListen(info) {
    const event = JSON.parse(info.data);
    if (event.type === "login_failure") {
      console.log(`Failed to login as ${this.botName}`);
      process.exit();
    }
    if (event.type === "online_users") {
      this.onlineUsers = event.users;
    }
    if (event.selfSend) {
      const resolve = this.queue[this.queue.length - 1];
      if (resolve) {
        resolve(event);
        this.queue.pop();
      }
      return;
    }
    //console.log(event);
    const onFunc = this.onFuncs[event.type];
    if (typeof onFunc === "function") {
      onFunc(event);
    }
    this.#onEvent(event);
  }

  on(...args) {
    const [callback, ...types] = args.reverse();
    for (const type of types) {
      this.onFuncs[type] = callback;
    }
  }

  onEvent(callback) {
    this.#onEvent = callback;
  }

  sendMessage(text, replyTo, isNotBot) {
    this.wsSend({
      type: replyTo ? "message_reply" : "message",
      text,
      replyTo,
      isBot: !!isNotBot,
    });
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  editMessage(text, messageID) {
    this.wsSend({
      type: "message_edit",
      text,
      messageID,
    });
  }
  async animate(text, interval, replyTo) {
    interval ??= 50;
    let resultText = "";
    const info = await this.sendMessage("", replyTo);
    for (const char of String(text).split("")) {
      await new Promise((i) => setTimeout(i, interval));
      resultText += char;
      this.editMessage(resultText, info.messageID);
    }
    return info;
  }
  async addCommands(prefix, commands) {
    try {
      const response = await axios.post(
        `${this.url}/api/commands/${this.token}`,
        {
          action: "add",
          commands,
          prefix,
        },
      );
      console.log(response.data.message);
    } catch (error) {
      console.error("Failed to add command:", error.message);
    }
  }

  async addCommand(prefix, commandName, description = "") {
    try {
      const response = await axios.post(
        `${this.url}/api/commands/${this.token}`,
        {
          action: "add",
          commands: [{ name: commandName, description }],
          prefix,
        },
      );
      console.log(response.data.message);
    } catch (error) {
      console.error("Failed to add command:", error.message);
    }
  }

  async deleteCommand(prefix, commandName) {
    try {
      const response = await axios.post(
        `${this.url}/api/commands/${this.token}`,
        {
          action: "delete",
          commands: [{ name: commandName }],
          prefix,
        },
      );
      console.log(response.data.message);
    } catch (error) {
      console.error("Failed to delete command:", error.message);
    }
  }

  async getCommandPrefixes() {
    try {
      const response = await axios.get(`${this.url}/api/prefixes`);
      return response.data;
    } catch (error) {
      console.error("Failed to get command prefixes:", error.message);
      return [];
    }
  }
  async endListening() {
    this.ws.close();
  }

  async sendSlashCommand(commandName, args = []) {
    try {
      const response = await axios.post(
        `${this.url}/api/commands/${this.token}/slash`,
        {
          command: commandName,
          args,
        },
      );
      console.log(response.data.message);
    } catch (error) {
      console.error("Failed to send slash command:", error.message);
    }
  }

  async sendCommandCheck(commandName) {
    this.wsSend({
      type: "command_check",
      commandName,
    });
  }

  isReady() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  wsSend(data) {
    if (!this.isReady()) {
      throw new Error("Connection not ready!");
    }
    this.ws?.send(
      JSON.stringify({
        ...data,
        accessToken: this.token,
        token: this.token,
        isOfficialBot: true,
      }),
    );
  }

  setBaseURL(url) {
    this.url = url;
    console.log(`Base URL set to ${url}`);
  }
}

function fcaXLLC(login) {
  return async function (...args) {
    if (!args[0]) {
      return;
    }
    const { username } = args[0] || {};
    if (!username) {
      return login;
    }
    const callback = args[1];
    const funcListen = async function () {};
    const [loginErr, firstApi] = await new Promise((resolve) => {
      try {
        login(args[0], (err, api) => {
          try {
            resolve([err, api]);
          } catch {
            resolve([err, null]);
          }
        });
      } catch (error) {
        resolve([error, null]);
      }
    });
    const bot = new LLCBot({
      username,
    });
    const api2 = new API(bot, firstApi, funcListen);
    const api = new Proxy(
      {},
      {
        get(_, prop) {
          if (api2[prop]) {
            return api2[prop];
          }
          if (firstApi && prop in firstApi) {
            return firstApi[prop];
          }
          return (...args) => {
            console.log(
              `api.${prop}(${args.map((i) => JSON.stringify(i)).join(", ")}) has no effect!`,
            );
          };
        },
        set(_, prop, value) {
          api2[prop] = value;
          return true;
        },
      },
    );

    if (callback) {
      await callback(loginErr, api);
    }
  };
}
class API {
  constructor(bot, api, funcListen) {
    this.bot = bot;
    this.api = api;
    this.funcListen = funcListen;
  }
  async sendMessage(form, thread, ...etc) {
    thread = String(thread);
    let body;
    if (typeof form === "string") {
      body = {
        body: form,
      };
    } else if (typeof form === "object") {
      body = {
        ...form,
      };
    } else {
      body = {};
    }
    if (thread.startsWith("LLC:")) {
      let info = await this.bot.sendMessage(body.body || "Empty", {
        text: "",
        username: thread.slice(4),
        head: "Replying to: " + thread.slice(4),
      });
      info = convertEvent(info);
      const callback =
        typeof etc[0] === "function"
          ? etc[0]
          : typeof etc[1] === "function"
            ? etc[1]
            : () => {};
      await callback(null, info);
      return info;
    } else if (typeof this.api?.sendMessage === "function") {
      return this.api?.sendMessage(body, thread, ...etc);
    }
  }
  editMessage(str, messageID, callback) {
    str = String(str);
    messageID = String(messageID);
    if (messageID.startsWith("LLC:")) {
      messageID = messageID.slice(4);
      const i = this.bot.editMessage(str, messageID);
      if (callback) {
        callback();
      }
      return i;
    }
    if (typeof this.api?.editMessage !== "function") {
      return;
    }
    return this.api?.editMessage(
      str,
      messageID,
      typeof callback === "function" ? callback : () => {},
    );
  }
  listenMqtt(callback) {
    this.funcListen = callback;
    const self = this;
    this.bot.on("message", "message_reply", async (event) => {
      await self.funcListen(null, convertEvent(event));
    });
    this.bot.startListening();
    if (typeof this.api?.listenMqtt !== "function") {
      return;
    }

    return this.api?.listenMqtt(this.funcListen);
  }
  get listen() {
    return this.listenMqtt;
  }
  getAppState() {
    if (typeof this.api?.getAppState !== "function") {
      return [];
    }

    return this.api?.getAppState?.() || [];
  }
  getThreadInfo(...args) {
    const x = {
      adminIDs: [],
      name: String(args[0]).slice(4),
      participantIDs: Array.from(this.bot.onlineUsers),
    };
    if (String(args[0]).startsWith("LLC:")) {
      return x;
    } else if (typeof this.api?.getThreadInfo === "function") {
      return this.api?.getThreadInfo?.(...args) || x;
    } else {
      return x;
    }
  }
}
function convertEvent(data) {
  return {
    body: data.text || "",
    senderID: `LLC:${data.username}`,
    messageID: `LLC:${data.messageID}`,
    type: data.type,
    messageReply: data.replyTo ? convertEvent(data.replyTo) : null,
    threadID: `LLC:${data.username}`,
    timestamp: Date.now(),
    attachments: [],
    isGroup: true,
  };
}

module.exports = { LLCBot, fcaXLLC, convertEvent, API };
