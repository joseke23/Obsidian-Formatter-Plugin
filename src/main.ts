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

		this.addRibbonIcon('dice', 'Reformat', (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});


		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (
				editor: Editor,
				_ctx: MarkdownView | MarkdownFileInfo,
			) => {
				editor.replaceSelection('Sample editor command');
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		await updateCurrent(this);
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
