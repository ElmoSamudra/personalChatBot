// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory, TurnContext } = require("botbuilder");

const { MakeReminderDialog } = require("./componentDialogs/makeReminderDialog");
const { LuisRecognizer, QnAMaker } = require("botbuilder-ai");

const {
  CancelReminderDialog,
} = require("./componentDialogs/cancelReminderDialog");

class CareBot extends ActivityHandler {
  constructor(conversationReferences, conversationState, userState) {
    super();

    // If the includeApiResults parameter is set to true, as shown below, the full response
    // from the LUIS api will be made available in the properties  of the RecognizerResult
    const dispatchRecognizer = new LuisRecognizer(
      {
        applicationId: process.env.LuisAppId,
        endpointKey: process.env.LuisAPIKey,
        endpoint: `https://${process.env.LuisAPIHostName}.api.cognitive.microsoft.com`,
      },
      {
        includeAllIntents: true,
        includeInstanceData: true,
      },
      true
    );

    const qnaMaker = new QnAMaker({
      knowledgeBaseId: process.env.QnAKnowledgebaseId,
      endpointKey: process.env.QnAEndpointKey,
      host: process.env.QnAEndpointHostName,
    });

    // Set intent recognizer
    this.dispatchRecognizer = dispatchRecognizer;
    this.qnaMaker = qnaMaker;

    // Dependency injected dictionary for storing ConversationReference objects used in NotifyController to proactively message users
    this.conversationReferences = conversationReferences;

    // Conversation State
    this.conversationState = conversationState;
    // User State
    this.userState = userState;

    // Dialogs
    this.dialogState = conversationState.createProperty("dialogState");
    this.makeReminderDialog = new MakeReminderDialog(
      this.conversationState,
      this.userState
    );
    this.cancelReminderDialog = new CancelReminderDialog(
      this.conversationState,
      this.userState
    );

    this.previousIntent = this.conversationState.createProperty(
      "previousIntent"
    );
    this.conversationData = this.conversationState.createProperty(
      "conservationData"
    );

    // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
    this.onMessage(async (context, next) => {
      // First, we use the dispatch model to determine which cognitive service (LUIS or QnA) to use.
      const recognizerResult = await dispatchRecognizer.recognize(context);

      // Top intent tell us which cognitive service to use.
      const intent = LuisRecognizer.topIntent(recognizerResult);

      await this.dispatchToIntentAsync(context, intent, recognizerResult);

      await next();
    });

    this.onDialog(async (context, next) => {
      // Save any state changes. The load happened during the execution of the Dialog.
      await this.conversationState.saveChanges(context, false);
      await this.userState.saveChanges(context, false);
      await next();
    });
    this.onMembersAdded(async (context, next) => {
      await this.sendWelcomeMessage(context);
      // By calling next() you ensure that the next BotHandler is run.
      await next();
    });
    this.onConversationUpdate(async (context, next) => {
      this.addConversationReference(context.activity);

      await next();
    });
  }

  async sendWelcomeMessage(turnContext) {
    const { activity } = turnContext;

    // Iterate over all new members added to the conversation.
    for (const idx in activity.membersAdded) {
      if (activity.membersAdded[idx].id !== activity.recipient.id) {
        const welcomeMessage =
          "Hey! Good to see you!\nHow can I help you today?";
        await turnContext.sendActivity(welcomeMessage);
        await this.sendSuggestedActions(turnContext);
      }
    }
  }

  async sendSuggestedActions(turnContext) {
    var reply = MessageFactory.suggestedActions(
      ["Create Reminder", "Cancel Reminder", "Hey!"],
      "What would you like to do today ?"
    );
    await turnContext.sendActivity(reply);
  }

  async dispatchToIntentAsync(context, intent, recognizerResult) {
    var currentIntent = "";
    const previousIntent = await this.previousIntent.get(context, {});
    const conversationData = await this.conversationData.get(context, {});

    // intents management
    if (previousIntent.intentName && conversationData.endDialog === false) {
      currentIntent = previousIntent.intentName;
    } else if (
      previousIntent.intentName &&
      conversationData.endDialog === true
    ) {
      currentIntent = context.activity.text;
    } else if (
      context.activity.text == "Create Reminder" ||
      context.activity.text == "Cancel Reminder"
    ) {
      currentIntent = context.activity.text;
      currentIntent = context.activity.text;
      await this.previousIntent.set(context, {
        intentName: context.activity.text,
      });
    } else {
      currentIntent = intent;
    }

    switch (currentIntent) {
      case "Create Reminder":
        console.log("Inside Create Reminder Case");
        await this.conversationData.set(context, { endDialog: false });
        await this.makeReminderDialog.run(context, this.dialogState);
        conversationData.endDialog = await this.makeReminderDialog.isDialogComplete();
        if (conversationData.endDialog) {
          await this.previousIntent.set(context, {
            intentName: null,
          });
          await context.sendActivity(
            "That was great!\nWorking with you is wonderful!"
          );
          await this.sendSuggestedActions(context);
        }
        break;
      case "Cancel Reminder":
        console.log("Inside Cancel Reminder Case");
        await this.conversationData.set(context, { endDialog: false });
        await this.cancelReminderDialog.run(context, this.dialogState);
        conversationData.endDialog = await this.cancelReminderDialog.isDialogComplete();
        if (conversationData.endDialog) {
          await this.previousIntent.set(context, {
            intentName: null,
          });
          await this.sendSuggestedActions(context);
        }
        break;
      case "l_HomeAutomation":
        await this.processHomeAutomation(context, recognizerResult.luisResult);
        break;
      case "l_Weather":
        await this.processWeather(context, recognizerResult.luisResult);
        break;
      case "q_sample-qna":
        await this.processSampleQnA(context);
        break;
      default:
        console.log("Did not match any case");
        break;
    }
  }
  async processSampleQnA(context) {
    console.log("processSampleQnA");

    const results = await this.qnaMaker.getAnswers(context);

    if (results.length > 0) {
      await context.sendActivity(`${results[0].answer}`);
    } else {
      await context.sendActivity(
        "Sorry, could not find an answer in the Q and A system."
      );
    }
  }
  async processHomeAutomation(context, luisResult) {
    console.log("processHomeAutomation");

    // Retrieve LUIS result for Process Automation.
    const result = luisResult.connectedServiceResult;
    const intent = result.topScoringIntent.intent;

    await context.sendActivity(`HomeAutomation top intent ${intent}.`);
    await context.sendActivity(
      `HomeAutomation intents detected:  ${luisResult.intents
        .map((intentObj) => intentObj.intent)
        .join("\n\n")}.`
    );

    if (luisResult.entities.length > 0) {
      await context.sendActivity(
        `HomeAutomation entities were found in the message: ${luisResult.entities
          .map((entityObj) => entityObj.entity)
          .join("\n\n")}.`
      );
    }
  }

  async processWeather(context, luisResult) {
    console.log("processWeather");

    // Retrieve LUIS results for Weather.
    const result = luisResult.connectedServiceResult;
    const topIntent = result.topScoringIntent.intent;

    await context.sendActivity(`ProcessWeather top intent ${topIntent}.`);
    await context.sendActivity(
      `ProcessWeather intents detected:  ${luisResult.intents
        .map((intentObj) => intentObj.intent)
        .join("\n\n")}.`
    );

    if (luisResult.entities.length > 0) {
      await context.sendActivity(
        `ProcessWeather entities were found in the message: ${luisResult.entities
          .map((entityObj) => entityObj.entity)
          .join("\n\n")}.`
      );
    }
  }

  addConversationReference(activity) {
    const conversationReference = TurnContext.getConversationReference(
      activity
    );
    this.conversationReferences[
      conversationReference.conversation.id
    ] = conversationReference;
  }
}

module.exports.CareBot = CareBot;
