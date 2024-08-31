import { Logger } from "./logger.js";
import { AutoHiddenRollsId } from "./const.js";
import { registerSettings } from "./settings.js";

const logger = new Logger("PF2e Hide Rolls |");

Hooks.once('init', async () => {
    registerSettings(logger);
});

Hooks.once('ready', async () =>{
    if (!game.user.isGM && game.settings.get(AutoHiddenRollsId, 'enable')) {
        chatLogButtonAppender();
        registerHookChatMessageInterceptor(logger);
    }
});

function chatLogButtonAppender() {
    const controls = ui.sidebar.element.find('#chat > #chat-controls > #dorako-rt-buttons');
    if (!controls) {
        logger.error("Could not find chat controls element");
        return;
    }
    const button = document.createElement('button');
    button.className = 'toggle button';
    if (game.settings.get(AutoHiddenRollsId, 'isAutoRollMode')) {
        controls.find("button.active").removeClass("active");
        button.classList.add('active');
    }
    button.innerHTML = '<i class="fas fa-magic"></i>';
    button.title = "Toggle Auto Hidden Rolls";
    button.onclick = () => {
        game.settings.set(AutoHiddenRollsId, 'isAutoRollMode', true);
        controls.find("button.active").removeClass("active");
        button.classList.add('active');
    };   
    controls.append(button);

    // Observe if dorako-rt-buttons are changed
    new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (!button.className.includes('active')) {
                    game.settings.set(AutoHiddenRollsId, 'isAutoRollMode', false);
                }
            }
        }
    }).observe(button, {
        attributes: true,
        attributeFilter: ['class'], 
    });

    // For sanity also check if rolemode is changed somewhere else
    const origOnChange = game.settings.settings.get('core.rollMode').onChange;
    game.settings.settings.get('core.rollMode').onChange = (mode) => {
        game.settings.set(AutoHiddenRollsId, 'isAutoRollMode', false);
        button.classList.remove('active');
        origOnChange(mode);
    };
}

function registerHookChatMessageInterceptor(logger) {    
    Hooks.on("preCreateChatMessage", (document, data, options) => {
        const pf2e = data?.flags?.pf2e;
        if (!data?.flags?.pf2e || !game.settings.get(AutoHiddenRollsId, 'isAutoRollMode')) {
            return
        }
        const type = pf2e.context.type;
        const config = game.settings.get(AutoHiddenRollsId, 'configuration');
        let rollMode;
        if (type === "skill-check") {
            if (config.rollTypes.skill.lore && pf2e.context.domains.includes("lore-skill-check")) {
                rollMode = config.rollTypes.skill.lore;
            } else {
                rollMode = config.rollTypes.skill[pf2e.modifierName];
            }
        } else if (type === "perception-check") {
            if (config.rollTypes.perception) {
                rollMode = config.rollTypes.perception.mode;
            }
        } else if (type === "flat-check" && pf2e.context.domains?.includes("dying-recovery-check")) {
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