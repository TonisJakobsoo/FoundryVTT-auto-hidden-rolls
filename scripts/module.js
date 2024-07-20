import { Logger } from "./logger.js";
import { AutoHiddenRollsId } from "./const.js";
import { registerSettings, AutoHiddenRollsConfig } from "./settings.js";

const logger = new Logger("PF2e Hide Rolls |");

Hooks.once('init', async () => {
    registerSettings(logger);
});

Hooks.once('ready', async () =>{
    if (!game.user.isGM) {
        registerHooks(logger);
    }
    //new AutoHiddenRollsConfig().render(true);
});

function registerHooks(logger) {
    Hooks.on("closeCheckModifiersDialog", (dialog) => {
        if (dialog.context.rollMode !== "roll") {
            return;
        }
        if (!game.settings.get(AutoHiddenRollsId, "enable")) {
            return;
        }
        const config = game.settings.get('auto-hidden-rolls', 'configuration');
        try {
            if (dialog.context.type == undefined) {
                if (dialog.check?.slug && dialog.check.slug === "Recovery Check" && config.rollTypes.death) {
                    let rollMode = config.rollTypes.death.mode;
                    logger.log(`Changing death save roll mode to ${rollMode}`);
                    dialog.context.rollMode = rollMode;
                }
            }

            switch (dialog.context.type) {
                case "perception-check":
                    if (config.rollTypes.perception) {
                        logger.log(`Changing roll mode to ${config.rollTypes.perception.mode}`);
                        dialog.context.rollMode = config.rollTypes.perception.mode;
                    }
                    break;
                case "skill-check":
                    const rollMode = config.rollTypes.skill[dialog.context.domains[0]];
                    if (rollMode) {
                        logger.log(`Changing ${dialog.context.domains[0]} roll mode to ${rollMode}`);
                        dialog.context.rollMode = rollMode;
                    }
                    break;
            }
        } catch (error) {
            logger.error(`Error changing roll mode of ${dialog.context.type}: ${error}`);
        }
    })
}