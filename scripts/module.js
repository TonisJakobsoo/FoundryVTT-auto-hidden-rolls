import { Logger } from "./logger.js";
import { AutoHiddenRollsId } from "./const.js";
import { registerSettings } from "./settings.js";

const logger = new Logger("PF2e Hide Rolls |");

Hooks.once('init', async () => {
    registerSettings(logger);
});

Hooks.once('ready', async () =>{
    if (!game.user.isGM) {
        registerHooks(logger);
    }
});

function registerHooks(logger) {
    Hooks.on("preCreateChatMessage", (document, data, options) => {
        const pf2e = data?.flags?.pf2e;
        if (options.rollMode !== "publicroll" || !pf2e) {
            return
        }
        const type = pf2e.context.type;
        const config = game.settings.get(AutoHiddenRollsId, 'configuration');
        debugger;
        let rollMode;
        if (type === "skill-check") {
            if (config.rollTypes.skill.lore && pf2e.context.domains.includes("lore-skill-check")) {
                rollMode = config.rollTypes.skill.lore;
            } else {
                rollMode = config.rollTypes.skill[pf2e.modifierName];
            }
        }
        else if (type === "perception-check") {
            if (config.rollTypes.perception) {
                rollMode = config.rollTypes.perception.mode;
            }
        }
        else if (type === "flat-check" && pf2e.context.domains?.includes("dying-recovery-check")) {
            if (config.rollTypes.death) {
                rollMode = config.rollTypes.death.mode;
            }
        }
        if (rollMode) {
            logger.log(`Changing roll mode of ${type} to ${rollMode}`);
            document.applyRollMode(rollMode);

            /** Possible one way to notify everyone                    **/
            /*  Bugs TODO:                                              */
            /*  - Roll result is visible to all players due to whisper  */
            /*  - NotSoNiceDice are rolling and revealing the result    */

            // const updates = {};
            // updates.whisper = ChatMessage.getWhisperRecipients("players").map(u => u.id);
            // document.updateSource(updates);
        }
    });
}