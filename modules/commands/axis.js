module.exports.config = {
  name: "axis",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Liane Cagara",
  description: "An AI command using LianeAPI!",
  usePrefix: false,
  allowPrefix: true,
  commandCategory: "chatbots",
  usages: "Axis [prompt]",
  cooldowns: 5,
};

module.exports.run = async function ({ box, args }) {
  box.lianeAPI("axis", "LianeAPI_Reworks", args.join(" "), {
    noEdit: false,
    key: "raw",
  });
};
