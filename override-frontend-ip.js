const replace = require("replace-in-file");

const options1 = {
  //Single file
  files: "public_serverside_record/index.js",

  //Replacement to make (string or regex)
  from: "process.env.RECORD_SERVER_IP",
  to: process.env.RECORD_SERVER_IP,
};

const options2 = {
  //Single file
  files: "public_serverside_record/index.js",

  //Replacement to make (string or regex)
  from: "process.env.RECORD_SERVER_PORT",
  to: process.env.RECORD_SERVER_PORT,
};

try {
  replace.sync(options1);
  replace.sync(options2);
} catch (error) {
  console.error("Error occurred:", error);
}
