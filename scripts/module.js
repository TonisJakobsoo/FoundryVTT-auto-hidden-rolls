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
    // Append the button to the controls
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
        }
    });
}

function registerChatRendererHook() {
    // TODO should use renderChatMessageHTML instead, but renderChatMessage hook is called later
    // This means something like actually-private-rolls module will override our changes
    Hooks.on('renderChatMessage', (message, [html], context) => {
        if (message.blind == false || !message.getFlag('auto-hidden-rolls', 'changed')) {
            return;
        }

        const pf2e = message.flags?.pf2e;
        if (!pf2e || !pf2e.context) {
            return;
        }

        const type = pf2e.context.type;
        let skillType = 'Roll';

        // Determine the skill type based on the message context
        if (type === "skill-check") {
            if (pf2e.context.domains?.includes("lore-skill-check")) {
                skillType = 'Lore';
            } else if (pf2e.modifierName) {
                const skillConfig = CONFIG.PF2E?.skills?.[pf2e.modifierName];
                if (skillConfig) {
                    skillType = skillConfig?.label && game.i18n.format(skillConfig?.label);
                } else {
                    skillType = pf2e.modifierName || 'Skill';
                }
            } else {
                skillType = 'Skill';
            }
        } else if (type === "perception-check") {
            skillType = 'Perception';
        } else if (type === "flat-check" && pf2e.context.domains?.includes("dying-recovery-check")) {
            skillType = 'Death Saving';
        }

        // Change the html message
        const baseMsg = html.dataset.messageId ? html : html.closest('[data-message-id]');
        baseMsg?.classList.remove('actually-private-roll');
        baseMsg?.querySelector('.message-content')?.replaceChildren();
        const header = baseMsg?.querySelector('.message-header');
        const existingFlavor = header?.querySelector('.flavor-text');

        const flavorHtml = document.createElement('span');
        flavorHtml.classList.add('flavor-text');
        flavorHtml.innerHTML = game.i18n.format("HIDDENROLLS.VisibleAffectedChatMessage", { skillType });

        if (existingFlavor) {
            existingFlavor.replaceWith(flavorHtml);
        } else {
            header.append(flavorHtml);
        }
        logger.log(`Rendered chat message for ${type} with visible affected rolls: ${skillType}`);
    });
}