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
        if (game.settings.get(AutoHiddenRollsId, 'visibleAffectedRolls')) {
            registerChatRendererHook();
        }
    }
});

function chatLogButtonAppender() {
    //Quite sure can just use chat rendering hook instead
    const controls = document.getElementById("roll-privacy")
    if (!controls) {
        logger.error("Could not find chat controls element");
        return;
    }

    // Create the button with the specified attributes
    const isEnabled = game.settings.get(AutoHiddenRollsId, 'isAutoRollMode');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ui-control icon fa-solid fa-magic';
    button.setAttribute('aria-pressed', isEnabled);
    button.setAttribute('aria-label', 'Toggle Auto Hidden Rolls'); // Replace with localized mode.label if needed
    controls.append(button);

    // TODO UI doesn't really match the reality. Technically if roll doesn't trigger auto-roll-mode
    // It will roll with the current active of the roll mode. UI should reflect that

    // Reset UI state
    if (isEnabled) {
        const allButtons = controls.querySelectorAll('button[data-action="rollMode"]');
        allButtons.forEach((btn) => {
            btn.setAttribute('aria-pressed', false);
        });
    }

    // Add click event listener
    button.onclick = () => {
        const previousState = game.settings.get(AutoHiddenRollsId, 'isAutoRollMode');
        const isActive = !previousState;
        game.settings.set(AutoHiddenRollsId, 'isAutoRollMode', isActive);
        button.setAttribute('aria-pressed', isActive);

        if (isActive) {
            controls.querySelectorAll('button[data-action="rollMode"]').forEach((btn) => {
                btn.setAttribute('aria-pressed', false);
            });
            button.setAttribute('aria-pressed', true);
        } else {
            // restore previous visual state
            const currentRollMode = game.settings.get('core', 'rollMode');
            const currentRollModeButton = controls.querySelector(`button[data-roll-mode="${currentRollMode}"]`);
            currentRollModeButton.setAttribute('aria-pressed', true);
        }
    };

    // Append the button to the controls


    // Observe if are changed
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
        logger.log(`Roll mode changed to ${mode}`);
        game.settings.set(AutoHiddenRollsId, 'isAutoRollMode', false);
        button.setAttribute('aria-pressed', false);
        origOnChange(mode);
    };
}

function registerHookChatMessageInterceptor(logger) {    
    Hooks.on("preCreateChatMessage", (document, data, options) => {
        const pf2e = data?.flags?.pf2e;
        if (!pf2e || !pf2e.context || !game.settings.get(AutoHiddenRollsId, 'isAutoRollMode')) {
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
            document.updateSource({"flags.auto-hidden-rolls.changed": true})
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

function registerChatRendererHook() {
    Hooks.on('renderChatMessage', () => {
        logger.log('Visible affected rolls not yet implemented');
    });
}