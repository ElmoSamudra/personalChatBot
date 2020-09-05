const { WaterfallDialog, ComponentDialog } = require("botbuilder-dialogs");

const {
  ConfirmPrompt,
  ChoicePrompt,
  DateTimePrompt,
  NumberPrompt,
  TextPrompt,
} = require("botbuilder-dialogs");

const { DialogSet, DialogTurnStatus } = require("botbuilder-dialogs");

const { CardFactory } = require("botbuilder");

const RestaurantCard = require("../resources/adaptiveCards/RestaurantCard.json");

const CARDS = [RestaurantCard];

const CHOICE_PROMPT = "CHOICE_PROMPT";
const CONFIRM_PROMPT = "CONFIRM_PROMPT";
const TEXT_PROMPT = "TEXT_PROMPT";
const NUMBER_PROMPT = "NUMBER_PROMPT";
const DATETIME_PROMPT = "DATETIME_PROMPT";
const WATERFALL_DIALOG = "WATERFALL_DIALOG";
var endDialog = "";

class CancelReminderDialog extends ComponentDialog {
  constructor(conservsationState, userState) {
    super("cancelReminderDialog");

    this.addDialog(new TextPrompt(TEXT_PROMPT));
    this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
    this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
    this.addDialog(new NumberPrompt(NUMBER_PROMPT));
    this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

    this.addDialog(
      new WaterfallDialog(WATERFALL_DIALOG, [
        this.firstStep.bind(this), // Ask confirmation cancel reminder
        this.confirmStep.bind(this), // confirm cancel reminder
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

  // Verify User's intentions to cancel a reminder
  async firstStep(step) {
    endDialog = false;
    //DISPAY ALL REMINDERS.. SET UP MEMORY SYSTEM
    await step.context.sendActivity({
      text: "Which reminder should I cancel?",
    });

    return await step.prompt(TEXT_PROMPT, "");
  }

  // Ask text input for which reminder to cancel
  async confirmStep(step) {
    step.values.reminderNo = step.result;

    var msg = ` You have entered following values: \n Resercation Number ${step.values.reminderNo}`;

    await step.context.sendActivity(msg);

    return await step.prompt(
      CONFIRM_PROMPT,
      "Are you sure you want to cancel this reminder?",
      ["yes", "no"]
    );
  }

  // cancel reminder and send confirmation
  async summaryStep(step) {
    if (step.result === true) {
      // Business

      await step.context.sendActivity("Done!");
      endDialog = true;
      return await step.endDialog();
    }
  }

  async isDialogComplete() {
    return endDialog;
  }
}

module.exports.CancelReminderDialog = CancelReminderDialog;
