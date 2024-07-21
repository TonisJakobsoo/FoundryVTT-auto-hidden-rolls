import { AutoHiddenRollsId } from "./const.js";

export function registerSettings(logger) {
    game.settings.register(AutoHiddenRollsId, "enable", {
        name: "HIDDENROLLS.Enable",
        default: true,
        scope: "client",
        type: Boolean,
        config: true,
        requiresReload: false,
    });

    game.settings.registerMenu(AutoHiddenRollsId, "configuration", {
        name: "HIDDENROLLS.Configuration",
        label: "HIDDENROLLS.ConfigurationLabel",
        icon: "fas fa-cogs",
        type: AutoHiddenRollsConfig,
        restricted: true
    });

    game.settings.register(AutoHiddenRollsId, "configuration", {
        name: "HIDDENROLLS.Configuration",
        scope: "world",
        default: {
            rollTypes: {
                perception: {
                    mode: CONST.DICE_ROLL_MODES.BLIND
                },
                death: {
                    mode: CONST.DICE_ROLL_MODES.PRIVATE
                },
                skill: {
                    arcana: CONST.DICE_ROLL_MODES.BLIND,
                    deception: CONST.DICE_ROLL_MODES.BLIND,
                    diplomacy: CONST.DICE_ROLL_MODES.BLIND,
                    medicine: CONST.DICE_ROLL_MODES.BLIND,
                    nature: CONST.DICE_ROLL_MODES.BLIND,
                    occultism: CONST.DICE_ROLL_MODES.BLIND,
                    religion: CONST.DICE_ROLL_MODES.BLIND,
                    society: CONST.DICE_ROLL_MODES.BLIND,
                    stealth: CONST.DICE_ROLL_MODES.BLIND,
                    survival: CONST.DICE_ROLL_MODES.BLIND
                }
            },
        },
        type: Object,
        config: false,
        onChange: config => {
            logger.log("Config changed", config);
        }
    });

    Handlebars.registerHelper('checkedIf', function (value, expected) {
        return value === expected ? 'checked' : '';
    });
}

export class AutoHiddenRollsConfig extends FormApplication {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
          title: game.i18n.localize("HIDDENROLLS.Configuration"),
          id: "auto-hidden-rolls-config",
          template: "modules/auto-hidden-rolls/templates/hidden-rolls-config.hbs",
          width: 400,
          height: "auto",
          scrollY: [".permissions-list"],
          closeOnSubmit: true
        });
    }

    /** @override */
    async getData(options={}) {
        const current = await game.settings.get(AutoHiddenRollsId, "configuration");
        return {
            rollModes: {
                default: 'Default',
                [CONST.DICE_ROLL_MODES.PRIVATE]: 'Private',
                [CONST.DICE_ROLL_MODES.BLIND]: 'Blind'
            },
            rolls: this._getRollModes(current)
        };
    }

    _getRollModes(current) {
        const skills = Object.keys(CONFIG.PF2E.skills).map(skill => ({
            name: 'skill.' + skill,
            label: CONFIG.PF2E.skills[skill].label,
            value: current.rollTypes.skill[skill] || 'default'
        }));
        const other = [
            { 
                name: 'other.perception',
                label: 'Perception',
                value: current.rollTypes.perception?.mode || 'default'
            },
            { 
                name: 'other.death',
                label: 'Death saving',
                value: current.rollTypes.death?.mode || 'default'
            }
        ]
        return {
            skill: skills,
            other: other
        }
    }

    /** @override */
    async _updateObject(event, formData) {
        const permissions = foundry.utils.expandObject(formData);
        const currentSettings = await game.settings.get(AutoHiddenRollsId, "configuration");
        
        currentSettings.rollTypes.skill = {};
        for(let [skill, mode] of Object.entries(permissions.skill)) {
            if (mode !== 'default') currentSettings.rollTypes.skill[skill] = mode;
        }
        for(let [otherSkill, mode] of Object.entries(permissions.other)) {
            if (mode !== 'default') {
                currentSettings.rollTypes[otherSkill] = { mode: mode }; ;
            } else {
                delete currentSettings.rollTypes[otherSkill];
            }
        }
        await game.settings.set(AutoHiddenRollsId, "configuration", currentSettings);
    }
}
