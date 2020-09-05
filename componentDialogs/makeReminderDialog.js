const { WaterfallDialog, ComponentDialog } = require("botbuilder-dialogs");

const {
  ConfirmPrompt,
  ChoicePrompt,
  DateTimePrompt,
  NumberPrompt,
  TextPrompt,
} = require("botbuilder-dialogs");

const { DialogSet, DialogTurnStatus } = require("botbuilder-dialogs");

const CHOICE_PROMPT = "CHOICE_PROMPT";
const CONFIRM_PROMPT = "CONFIRM_PROMPT";
const TEXT_PROMPT = "TEXT_PROMPT";
const NUMBER_PROMPT = "NUMBER_PROMPT";
const DATETIME_PROMPT = "DATETIME_PROMPT";
const WATERFALL_DIALOG = "WATERFALL_DIALOG";
var endDialog = "";

class MakeReminderDialog extends ComponentDialog {
  constructor(conservsationState, userState) {
    super("makeReminderDialog");

    this.addDialog(new TextPrompt(TEXT_PROMPT));
    this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
    this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
    this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

    this.addDialog(
      new WaterfallDialog(WATERFALL_DIALOG, [
        this.firstStep.bind(this), // Ask confirmation create reminder
        this.getName.bind(this), // Get name of reminder
        this.getDate.bind(this), // Date
        this.getTime.bind(this), // Time
        this.confirmStep.bind(this), // Show summary of values entered by user and ask confirmation
        this.summaryStep.bind(this),
      ])
    );

    this.initialDialogId = WATERFALL_DIALOG;
  }

  async run(turnContext, accessor) {
    const dialogSet = new DialogSet(accessor);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(turnContext);
    const results = await dialogContext.continueDialog();
    if (results.status === DialogTurnStatus.empty) {
      await dialogContext.beginDialog(this.id);
    }
  }

  // Confirm user's intentions on creating a reminder
  async firstStep(step) {
    endDialog = false;
    // Running a prompt here means the next WaterfallStep will be run when the users response is received.
    return await step.prompt(
      CONFIRM_PROMPT,
      "Confirm creating a new reminder?",
      ["yes", "no"]
    );
  }

  // Ask text input for the name of the new reminder
  async getName(step) {
    console.log(step.result);
    if (step.result === true) {
      return await step.prompt(
        TEXT_PROMPT,
        "What should I call this reminder?"
      );
    }
    if (step.result === false) {
      await step.context.sendActivity("Ok! Cancelled.");
      endDialog = true;
      return await step.endDialog();
    }
  }

  // Date input
  async getDate(step) {
    step.values.name = step.result;

    return await step.prompt(
      DATETIME_PROMPT,
      "On which date is this reminder for?"
    );
  }

  //Time input
  async getTime(step) {
    step.values.date = step.result;

    return await step.prompt(
      DATETIME_PROMPT,
      "At what time should I remind you?"
    );
  }

  //Confirmation to create the reminder
  async confirmStep(step) {
    step.values.time = step.result;

    var msg = `Remind you to: ${step.values.name} on ${JSON.stringify(
      step.values.date[0].value
    )} at ${JSON.stringify(step.values.time[0].value)}`;

    await step.context.sendActivity(msg);

    return await step.prompt(CONFIRM_PROMPT, "Create this reminder?", [
      "yes",
      "no",
    ]);
  }

  // Notify user reminder is set
  async summaryStep(step) {
    if (step.result === true) {
      // Create

      await step.context.sendActivity("Got it!");
      endDialog = true;
      return await step.endDialog();
    }
    if (step.result === false) {
      await step.context.sendActivity("Oh too bad...");
      endDialog = true;
      return await step.endDialog();
    }
  }

  async isDialogComplete() {
    return endDialog;
  }
}

module.exports.MakeReminderDialog = MakeReminderDialog;
