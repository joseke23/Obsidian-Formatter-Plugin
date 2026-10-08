import { App, PluginSettingTab, Setting } from 'obsidian';
import AutoFormatter from './main.js';

export interface PluginSettings {
	weekTemplatePath: string;
	monthTemplatePath: string;
	yearTemplatePath: string;
	currentFolderPath: string;
	oldFolderPath: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	weekTemplatePath: "",
	monthTemplatePath: "",
	yearTemplatePath: "",
	currentFolderPath: "",
	oldFolderPath: ""
}

export class SettingTab extends PluginSettingTab {
	plugin: AutoFormatter;

	constructor(app: App, plugin: AutoFormatter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName("Update current").setHeading();



		this.addPathSetting(
			containerEl,
			'Week template',
			'Path to the template used for weekly notes.',
			'weekTemplatePath',
		);
		this.addPathSetting(
			containerEl,
			'Month template',
			'Path to the template used for monthly notes.',
			'monthTemplatePath',
		);
		this.addPathSetting(
			containerEl,
			'Year template',
			'Path to the template used for yearly notes.',
			'yearTemplatePath',
		);
		this.addPathSetting(
			containerEl,
			'Current folder',
			'Folder where current notes are stored.',
			'currentFolderPath',
		);
		this.addPathSetting(
			containerEl,
			'Old folder',
			'Folder where old notes are archived.',
			'oldFolderPath',
		);
	}

	private addPathSetting(
		containerEl: HTMLElement,
		name: string,
		description: string,
		key: keyof PluginSettings,
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) =>
				text
					.setPlaceholder('Folder/note.md')
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] = value;
						await this.plugin.saveSettings();
					}),
			);
	}
	getSettingDefinitions() {
		return {
			weekTemplatePath: {
				name: "Week template",
				description: "Path to the template used for weekly notes.",
				type: "string",
				default: "",
			},
			monthTemplatePath: {
				name: "Month template",
				description: "Path to the template used for monthly notes.",
				type: "string",
				default: "",
			},
			yearTemplatePath: {
				name: "Year template",
				description: "Path to the template used for yearly notes.",
				type: "string",
				default: "",
			},
			currentFolderPath: {
				name: "Current folder",
				description: "Folder where current notes are stored.",
				type: "string",
				default: "",
			},
			oldFolderPath: {
				name: "Old folder",
				description: "Folder where old notes are archived.",
				type: "string",
				default: "",
			},
		};
	}
}
