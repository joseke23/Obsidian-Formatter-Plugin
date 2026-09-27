import { App, PluginSettingTab, Setting } from 'obsidian';
import AutoFormatter from './main.js';

export interface PluginSettings {
	mySetting: string;
	weekTemplatePath: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	mySetting: 'default',
};

export class SettingTab extends PluginSettingTab {
	plugin: AutoFormatter;

	constructor(app: App, plugin: AutoFormatter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder('Enter your secret')
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
