import { Logger } from "./logger.js";
import { AutoHiddenRollsId } from "./const.js";
import { registerSettings } from "./settings.js";

const logger = new Logger("PF2e Hide Rolls |");

Hooks.once('init', async () => {
    registerSettings(logger);
    Hooks.on("renderSidebar", (_, html) => {
        if (!game.user.isGM && game.settings.get(AutoHiddenRollsId, 'enable')) {
            appendChatLogButton();
        }
    });
});

Hooks.once('ready', async () =>{
    if (!game.user.isGM && game.settings.get(AutoHiddenRollsId, 'enable')) {
        Hooks.on("preCreateChatMessage", (chatMessage, data) => changeRollMode(chatMessage, data));
        if (game.settings.get(AutoHiddenRollsId, 'visibleAffectedRolls')) {
            // TODO should use renderChatMessageHTML instead, but renderChatMessage hook is called later
            // This means something like actually-private-rolls module will override our changes
            Hooks.on('renderChatMessage', (message, [html]) => onRenderChatMessage(message, html));
        }
    }
});

function appendChatLogButton() {
    const controls = document.getElementById("roll-privacy");
    if (!controls) {
        logger.error("Could not find chat controls element");
        return;
    }

    // Create the button with the specified attributes
    const isEnabled = game.settings.get(AutoHiddenRollsId, 'isAutoRollMode');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ui-control icon fa-solid fa-magic';
    button.classList.toggle('auto-hidden-roll-button');
    button.classList.toggle('active', isEnabled);
    button.setAttribute('aria-label', 'Toggle Auto Hidden Rolls');
    button.setAttribute('data-tooltip', '');
    // Append the button to the controls
    controls.append(button);

    // Simple toggle button - doesn't interfere with existing roll mode selection
    button.onclick = () => {
        const previousState = game.settings.get(AutoHiddenRollsId, 'isAutoRollMode');
        const isActive = !previousState;
        game.settings.set(AutoHiddenRollsId, 'isAutoRollMode', isActive);
        button.classList.toggle('active', isActive);
    };
}

function changeRollMode(chatMessage, data) {
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
        chatMessage.updateSource({"flags.auto-hidden-rolls.changed": true})
        chatMessage.applyRollMode(rollMode);
    }
}

function onRenderChatMessage(message, html) {
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
}