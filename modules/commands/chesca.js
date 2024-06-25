/* Make sure to have Botpack ^1.7.6 before installing! */

module.exports["config"] = {
  name: "chesca",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Liane Cagara",
  description: "An AI command using LianeAPI!",
  usePrefix: false,
  allowPrefix: true,
  commandCategory: "chatbots",
  usages: "chesca [prompt]",
  cooldowns: 5,
};

module.exports["run"] = async function ({ box, args, api, event }) {
  if (!box || !box?.lianeAPI) {
    return api.sendMessage(
      "Unsupported Version, please update your botpack, and run npm install.",
      event.threadID,
      event.messageID,
    );
  }
  box.lianeAPI("chesca1", "LianeAPI_Reworks", args.join(" "), {
    noEdit: false,
    key: "raw",
  });
};
