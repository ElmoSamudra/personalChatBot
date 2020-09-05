// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const dotenv = require("dotenv");
const path = require("path");
const restify = require("restify");

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const {
  BotFrameworkAdapter,
  MemoryStorage,
  ConversationState,
  UserState,
} = require("botbuilder");

// This bot's main dialog.
const { CareBot } = require("./CareBot");

// Import required bot configuration.
const ENV_FILE = path.join(__dirname, ".env");
require("dotenv").config({ path: ENV_FILE });

// Create HTTP server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
  console.log(`\n${server.name} listening to ${server.url}`);
  console.log(
    "\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator"
  );
  console.log('\nTo talk to your bot, open the emulator select "Open Bot"');
});

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about how bots work.
const adapter = new BotFrameworkAdapter({
  appId: process.env.MicrosoftAppId,
  appPassword: process.env.MicrosoftAppPassword,
});

// Catch-all for errors.
const onTurnErrorHandler = async (context, error) => {
  // This check writes out errors to console log .vs. app insights.
  // NOTE: In production environment, you should consider logging this to Azure
  //       application insights.
  console.error(`\n [onTurnError] unhandled error: ${error}`);

  // Send a trace activity, which will be displayed in Bot Framework Emulator
  await context.sendTraceActivity(
    "OnTurnError Trace",
    `${error}`,
    "https://www.botframework.com/schemas/error",
    "TurnError"
  );

  // Send a message to the user
  await context.sendActivity("The bot encountered an error or bug.");
  await context.sendActivity(
    "To continue to run this bot, please fix the bot source code."
  );
};

// Set the onTurnError for the singleton BotFrameworkAdapter.
adapter.onTurnError = onTurnErrorHandler;

const memmoryStorage = new MemoryStorage();

const conversationState = new ConversationState(memmoryStorage);
const userState = new UserState(MemoryStorage);

// Reference for notifications
const conversationReferences = {};

// Create the main dialog.
const Bot = new CareBot(conversationReferences, conversationState, userState);

// Listen for incoming requests.
server.post("/api/messages", (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    // Route to main dialog.
    await Bot.run(context);
  });
});

// Listen for incoming notifications and send proactive messages to users.
const breakMessages = [
  "Its been a while since you've been working.. I recommend taking a small break. :)",
  "Hey you've been working hard! Time to catch a break. ;)",
  "What?? Break Time? OH I almost forgot to remind you!",
];
server.get("/api/notify", async (req, res) => {
  for (const conversationReference of Object.values(conversationReferences)) {
    await adapter.continueConversation(
      conversationReference,
      async (turnContext) => {
        // If you encounter permission-related errors when sending this message, see
        // https://aka.ms/BotTrustServiceUrl
        await turnContext.sendActivity(breakMessages[getRandomInt(3)]);
      }
    );
  }

  res.setHeader("Content-Type", "text/html");
  res.writeHead(200);
  res.write(
    "<html><body><h1>Proactive messages have been sent.</h1></body></html>"
  );
  res.end();
});

/***
 * Api call to for the caring time
 */
setInterval(async () => {
  const res = await fetch("http://localhost:3978/api/notify");
}, 60000);

/**
 * Get random integer from 0 not including max number
 */
function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}
