import {
	Editor,
	MarkdownView,
	MarkdownFileInfo,
	Notice,
	Plugin,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	PluginSettings,
	SettingTab,
	getConfiguredPeriods,
} from './settings.js';
import { updateCurrent } from './commands/UpdateCurrent.js';


// Remember to rename these classes and interfaces!

export default class AutoFormatter extends Plugin {
	settings!: PluginSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('dice', 'Reformat', async (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			await updateCurrent(this, new Date(), this.settings.daysAhead).catch((error) => {
				new Notice(`Error updating current files: ${error}`);
			});
		});


		this.addCommand({
			id: 'update-current',
			name: 'Update current files',
			callback: async () => {
				await updateCurrent(this, new Date(), this.settings.daysAhead).catch((error) => {
					new Notice(`Error updating current files: ${error}`);
				});
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		this.app.workspace.onLayoutReady(async () => {
			await updateCurrent(this, new Date(), this.settings.daysAhead);

		});
	}

	onunload() { }

	async loadSettings() {
		const savedSettings = (await this.loadData()) as Partial<PluginSettings>;
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			savedSettings,
			{ periods: getConfiguredPeriods(savedSettings.periods) },
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
