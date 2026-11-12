import { App, PluginSettingTab, Setting } from 'obsidian';
import AutoFormatter from './main.js';
export const DEFAULT_PERIODS: Period[] = [{
	name: "Day",
	templatePath: "",
	archivePath: "yyyy/MM/",
	filenameFormat: "Day /yyyy-MM-dd/",
	periodDefinition: (now: Date) => {
		const startOfDay = new Date(now);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(startOfDay);
		endOfDay.setHours(23, 59, 59, 999);
		return [startOfDay, endOfDay];
	}
} as Period,
{
	name: "Week",
	templatePath: "",
	archivePath: "yyyy/MM/",
	filenameFormat: "Week /yyyy-MM-dd/",
	periodDefinition: (now: Date) => {
		const startOfWeek = new Date(now);
		startOfWeek.setDate(now.getDate() - now.getDay() + 1);
		startOfWeek.setHours(0, 0, 0, 0);
		const endOfWeek = new Date(startOfWeek);
		endOfWeek.setDate(startOfWeek.getDate() + 6);
		endOfWeek.setHours(23, 59, 59, 999);
		return [startOfWeek, endOfWeek];
	}
} as Period,
{
	name: "Month",
	templatePath: "",
	archivePath: "yyyy/MM/",
	filenameFormat: "Month /yyyy-MM/",
	periodDefinition: (now: Date) => {
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		endOfMonth.setHours(23, 59, 59, 999);
		return [startOfMonth, endOfMonth];
	}
} as Period,
{
	name: "Year",
	templatePath: "",
	archivePath: "yyyy/",
	filenameFormat: "Year /yyyy/",
	periodDefinition: (now: Date) => {
		const startOfYear = new Date(now.getFullYear(), 0, 1);
		const endOfYear = new Date(now.getFullYear(), 11, 31);
		endOfYear.setHours(23, 59, 59, 999);
		return [startOfYear, endOfYear];
	}
} as Period
];


export interface Period {
	name: string;
	templatePath: string;
	archivePath: string;
	filenameFormat: string;
	periodDefinition: (now: Date) => [Date, Date];
}

export interface PluginSettings {
	periods: Period[];
	currentFolderPath: string;
	archiveFolderPath: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	periods: DEFAULT_PERIODS,
	currentFolderPath: "",
	archiveFolderPath: ""
}

export function getConfiguredPeriods(configuredPeriods?: Partial<Period>[]): Period[] {
	if (!Array.isArray(configuredPeriods)) {
		return DEFAULT_PERIODS;
	}

	const configuredByName = new Map(
		configuredPeriods
			.filter((period): period is Partial<Period> & Pick<Period, 'name'> => typeof period.name === 'string')
			.map((period) => [period.name, period]),
	);

	return DEFAULT_PERIODS
		.filter((period) => configuredByName.has(period.name))
		.map((period) => ({
			...period,
			...configuredByName.get(period.name),
			periodDefinition: period.periodDefinition,
		}));
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
			'Current folder',
			'Folder where current notes are stored.',
			'currentFolderPath',
		);
		this.addPathSetting(
			containerEl,
			'Archive folder',
			'Folder where old notes are archived.',
			'archiveFolderPath',
		);

		new Setting(containerEl).setName("Periods").setHeading();
		for (const period of DEFAULT_PERIODS) {
			this.addPeriodToggle(containerEl, period);
		}
	}

	private addPeriodToggle(containerEl: HTMLElement, period: Period): void {
		const configuredPeriod = this.plugin.settings.periods.find(({ name }) => name === period.name);
		containerEl.createEl('h4', { text: period.name });
		new Setting(containerEl)
			.setName(period.name)
			.setDesc(`Turn on ${period.name.toLowerCase()} notes.`)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.periods.some(({ name }) => name === period.name))
					.onChange(async (enabled) => {
						const selectedNames = new Set(this.plugin.settings.periods.map(({ name }) => name));
						if (enabled) {
							selectedNames.add(period.name);
						} else {
							selectedNames.delete(period.name);
						}

						this.plugin.settings.periods = DEFAULT_PERIODS.filter(({ name }) => selectedNames.has(name));
						await this.plugin.saveSettings();
					}),
			);
		/*if (!this.plugin.settings.periods.some(({ name }) => name === period.name)) {
			return;
		}*/
		new Setting(containerEl)
			.setName(period.name)
			.setDesc(`Template for ${period.name.toLowerCase()} notes.`)
			.addText((text) =>
				text
					.setPlaceholder('Folder/note.md')
					.setValue(configuredPeriod?.templatePath ?? period.templatePath)
					.onChange(async (templatePath) => {
						const selectedPeriod = this.plugin.settings.periods.find(({ name }) => name === period.name);
						if (selectedPeriod) {
							selectedPeriod.templatePath = templatePath;
							await this.plugin.saveSettings();
						}
					}),
			);
		new Setting(containerEl)
			.setName(period.name)
			.setDesc(`Archive path for ${period.name.toLowerCase()} notes.`)
			.addText((text) =>
				text
					.setPlaceholder('/yyyy/MM/')
					.setValue(configuredPeriod?.archivePath ?? period.archivePath)
					.onChange(async (archivePath) => {
						const selectedPeriod = this.plugin.settings.periods.find(({ name }) => name === period.name);
						if (selectedPeriod) {
							selectedPeriod.archivePath = archivePath;
							await this.plugin.saveSettings();
						}
					}),
			);
		new Setting(containerEl)
			.setName(period.name)
			.setDesc(`Naming scheme for ${period.name.toLowerCase()} notes.`)
			.addText((text) =>
				text
					.setPlaceholder(`${period.name} /yyyy-MM-dd/`)
					.setValue(configuredPeriod?.filenameFormat ?? period.filenameFormat)
					.onChange(async (filenameFormat) => {
						const selectedPeriod = this.plugin.settings.periods.find(({ name }) => name === period.name);
						if (selectedPeriod) {
							selectedPeriod.filenameFormat = filenameFormat;
							await this.plugin.saveSettings();
						}
					}),
			);
	}

	private addPathSetting<K extends keyof PluginSettings>(
		containerEl: HTMLElement,
		name: string,
		description: string,
		key: K & (PluginSettings[K] extends string ? K : never),
	): void {
		const currentValue = this.plugin.settings[key];

		if (typeof currentValue !== 'string') {
			return;
		}
		new Setting(containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) =>
				text
					.setPlaceholder('Folder/note.md')
					.setValue(currentValue)
					.onChange(async (value) => {
						(this.plugin.settings[key] as string) = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
